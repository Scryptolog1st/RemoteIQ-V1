// remoteiq-minimal-e2e/agent-windows/RemoteIQ.Agent/Services/AgentService.cs
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RemoteIQ.Agent.Models;
using RemoteIQ.Agent.Options;
using RemoteIQ.Agent.Services.Http;
using RemoteIQ.Agent.Services.Security;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Threading;
using System.Threading.Tasks;
using System.Management;
using RemoteIQ.Agent.Services.Collectors;
using System;
using System.Linq;

namespace RemoteIQ.Agent.Services;

public class AgentService : BackgroundService
{
    private readonly ILogger<AgentService> _log;
    private readonly ApiClient _api;
    private readonly TokenStore _tokenStore;
    private readonly EnrollmentClient _enrollment;
    private readonly WebSocketClient _ws;
    private readonly AgentOptions _options;

    public AgentService(
        ILogger<AgentService> log,
        ApiClient api,
        TokenStore tokenStore,
        EnrollmentClient enrollment,
        WebSocketClient ws,
        IOptions<AgentOptions> options)
    {
        _log = log;
        _api = api;
        _tokenStore = tokenStore;
        _enrollment = enrollment;
        _ws = ws;
        _options = options.Value;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _log.LogInformation("Agent starting…");

        // ✅ Enroll with required parameters: os, arch, version, hostname, ct
        var os = GetOsName();
        var arch = GetArch();
        var version = GetAgentVersion();
        var hostname = Environment.MachineName;
        await _enrollment.EnrollAsync(os, arch, version, hostname, stoppingToken);

        var tokenData = _tokenStore.Load();
        if (tokenData is null || string.IsNullOrWhiteSpace(tokenData.AgentToken) || tokenData.AgentId is null || tokenData.DeviceId is null)
        {
            _log.LogError("Enrollment/token missing after EnrollAsync. Agent cannot continue.");
            return;
        }

        _api.SetBearer(tokenData.AgentToken);

        try { await _ws.StartAsync(stoppingToken); } catch { /* non-fatal */ }

        var seconds = _options.PollIntervalSeconds > 0 ? _options.PollIntervalSeconds : 60;
        var period = TimeSpan.FromSeconds(seconds);
        using var timer = new PeriodicTimer(period);
        _log.LogInformation("Heartbeat every {Seconds}s", seconds);

        await SendPingOnce(stoppingToken);

        // One-shot software upload after first ping (best-effort)
        _ = Task.Run(() => SendSoftwareOnce(stoppingToken), stoppingToken);

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            await SendPingOnce(stoppingToken);

            // Roughly hourly software refresh
            if (DateTimeOffset.UtcNow.Minute == 0)
                _ = Task.Run(() => SendSoftwareOnce(stoppingToken), stoppingToken);
        }
    }

    private async Task SendPingOnce(CancellationToken ct)
    {
        try
        {
            var os = GetOsName();
            var arch = GetArch();
            var version = GetAgentVersion();
            var primaryIp = GetPrimaryIPv4();
            var user = GetInteractiveUserViaWmi()
                       ?? GetLoggedInUserInteractive()
                       ?? GetLoggedInUserServiceContext();

            await _api.PingAsync(new PingRequest(
                Os: os,
                Arch: arch,
                Version: version,
                PrimaryIp: primaryIp,
                User: user
            ), ct);

            _log.LogDebug("Ping OK (os={Os} arch={Arch} ver={Ver} ip={Ip} user={User})",
                os, arch, version, primaryIp, user);
        }
        catch (OperationCanceledException) { }
        catch (HttpRequestException ex)
        {
            _log.LogWarning(ex, "Ping HTTP error.");
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Ping failed.");
        }
    }

    private async Task SendSoftwareOnce(CancellationToken ct)
    {
        try
        {
            var items = SoftwareCollector.Collect();
            if (items.Count == 0) return;

            await _api.SubmitSoftwareAsync(items, ct);
            _log.LogInformation("Uploaded {Count} software rows.", items.Count);
        }
        catch (OperationCanceledException) { }
        catch (HttpRequestException ex)
        {
            _log.LogWarning(ex, "Software upload HTTP error.");
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Software upload failed.");
        }
    }

    private static string GetOsName()
        => RuntimeInformation.IsOSPlatform(OSPlatform.Windows) ? "windows"
         : RuntimeInformation.IsOSPlatform(OSPlatform.Linux) ? "linux"
         : RuntimeInformation.IsOSPlatform(OSPlatform.OSX) ? "macos"
         : "unknown";

    private static string GetArch()
        => RuntimeInformation.OSArchitecture switch
        {
            Architecture.X64 => "x64",
            Architecture.X86 => "x86",
            Architecture.Arm64 => "arm64",
            _ => RuntimeInformation.OSArchitecture.ToString().ToLowerInvariant()
        };

    private static string GetAgentVersion()
    {
        try
        {
            return System.Reflection.Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "1.0.0";
        }
        catch { return "1.0.0"; }
    }

    private static string? GetPrimaryIPv4()
    {
        try
        {
            foreach (var ni in NetworkInterface.GetAllNetworkInterfaces())
            {
                if (ni.OperationalStatus != OperationalStatus.Up) continue;
                var ipProps = ni.GetIPProperties();
                foreach (var ua in ipProps.UnicastAddresses)
                {
                    if (ua.Address.AddressFamily != AddressFamily.InterNetwork) continue;
                    var s = ua.Address.ToString();
                    if (IsPrivateIPv4(s)) return s;
                }
            }

            foreach (var addr in Dns.GetHostAddresses(Dns.GetHostName()))
            {
                if (addr.AddressFamily == AddressFamily.InterNetwork) return addr.ToString();
            }
        }
        catch { }
        return null;

        static bool IsPrivateIPv4(string ip)
        {
            if (IPAddress.TryParse(ip, out var addr))
            {
                var b = addr.GetAddressBytes();
                if (b[0] == 10) return true;
                if (b[0] == 172 && b[1] >= 16 && b[1] <= 31) return true;
                if (b[0] == 192 && b[1] == 168) return true;
            }
            return false;
        }
    }

    private static string? GetInteractiveUserViaWmi()
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            return null;

        try
        {
            using var cls = new ManagementClass("Win32_ComputerSystem");
            using var instances = cls.GetInstances();
            foreach (ManagementObject mo in instances)
            {
                var user = (mo["UserName"] as string)?.Trim();
                if (!string.IsNullOrWhiteSpace(user))
                    return user;
            }
        }
        catch { }
        return null;
    }

    private static string? GetLoggedInUserInteractive()
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            return null;

        try
        {
            uint sessionId = WTSGetActiveConsoleSessionId();
            if (sessionId == 0xFFFFFFFF) return null;

            if (!WTSQuerySessionInformation(IntPtr.Zero, sessionId, WTS_INFO_CLASS.WTSUserName, out var userPtr, out _)
                || userPtr == IntPtr.Zero) return null;

            try
            {
                var user = Marshal.PtrToStringUni(userPtr)?.Trim();
                if (string.IsNullOrWhiteSpace(user)) return null;

                string? domain = null;
                if (WTSQuerySessionInformation(IntPtr.Zero, sessionId, WTS_INFO_CLASS.WTSDomainName, out var domPtr, out _)
                    && domPtr != IntPtr.Zero)
                {
                    try { domain = Marshal.PtrToStringUni(domPtr)?.Trim(); }
                    finally { WTSFreeMemory(domPtr); }
                }

                return string.IsNullOrWhiteSpace(domain) ? user : $"{domain}\\{user}";
            }
            finally
            {
                WTSFreeMemory(userPtr);
            }
        }
        catch
        {
            return null;
        }
    }

    private static string GetLoggedInUserServiceContext()
    {
        try
        {
            using var wi = WindowsIdentity.GetCurrent();
            return wi?.Name ?? Environment.UserName;
        }
        catch
        {
            return Environment.UserName;
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        try { await _ws.DisposeAsync(); } catch { }
        await base.StopAsync(cancellationToken);
    }

    private enum WTS_INFO_CLASS
    {
        WTSInitialProgram = 0,
        WTSApplicationName = 1,
        WTSWorkingDirectory = 2,
        WTSOEMId = 3,
        WTSSessionId = 4,
        WTSUserName = 5,
        WTSWinStationName = 6,
        WTSDomainName = 7,
        WTSConnectState = 8,
        WTSClientBuildNumber = 9,
        WTSClientName = 10,
        WTSClientDirectory = 11,
        WTSClientProductId = 12,
        WTSClientHardwareId = 13,
        WTSClientAddress = 14,
        WTSClientDisplay = 15,
        WTSClientProtocolType = 16
    }

    [DllImport("wtsapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool WTSQuerySessionInformation(
        IntPtr hServer,
        uint sessionId,
        WTS_INFO_CLASS wtsInfoClass,
        out IntPtr ppBuffer,
        out int pBytesReturned);

    [DllImport("wtsapi32.dll")]
    private static extern void WTSFreeMemory(IntPtr pMemory);

    [DllImport("kernel32.dll")]
    private static extern uint WTSGetActiveConsoleSessionId();
}
