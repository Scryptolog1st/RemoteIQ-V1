using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Win32;
using RemoteIQ.Agent.Models;             // AgentConfig.From(...)
using RemoteIQ.Agent.Services.Security;  // TokenStore
using System.Runtime.InteropServices;

namespace RemoteIQ.Agent.Services;

public class EnrollmentClient
{
    private readonly ILogger<EnrollmentClient> _log;
    private readonly IConfiguration _cfg;
    private readonly TokenStore _tokenStore;

    public EnrollmentClient(ILogger<EnrollmentClient> log, IConfiguration cfg, TokenStore tokenStore)
    {
        _log = log;
        _cfg = cfg;
        _tokenStore = tokenStore;
    }

    public async Task EnrollAsync(
        string os,
        string arch,
        string version,
        string hostname,
        CancellationToken ct)
    {
        var baseUrl = AgentConfig.From(_cfg).ApiBase.TrimEnd('/');

        var enrollmentSecret = _cfg["Agent:EnrollmentSecret"] ?? _cfg["EnrollmentSecret"] ?? "";
        if (string.IsNullOrWhiteSpace(enrollmentSecret))
            throw new InvalidOperationException("Missing Agent:EnrollmentSecret in configuration.");

        var deviceId = _cfg["Agent:DeviceId"] ?? DeriveDeviceId(hostname);
        if (string.IsNullOrWhiteSpace(deviceId))
            throw new InvalidOperationException("Unable to resolve a deviceId.");

        if (deviceId.Length > 200) deviceId = deviceId[..200];
        if (enrollmentSecret.Length > 200) enrollmentSecret = enrollmentSecret[..200];

        var candidates = new[]
        {
            $"{baseUrl}/api/agents/enroll",
            $"{baseUrl}/api/agent/enroll",
            $"{baseUrl}/api/auth/agents/enroll",
        };

        var payload = new
        {
            deviceId,
            enrollmentSecret,
            hostname,
            os,
            arch,
            version
        };

        Exception? lastErr = null;
        using var http = new HttpClient() { Timeout = TimeSpan.FromSeconds(20) };

        foreach (var url in candidates)
        {
            try
            {
                _log.LogInformation(
                    "Enrolling device {Host} (os={Os} arch={Arch} ver={Ver}) via {Url}",
                    hostname, os, arch, version, url);

                using var res = await http.PostAsJsonAsync(url, payload, ct);

                if ((int)res.StatusCode == 404)
                {
                    _log.LogDebug("Enroll endpoint {Url} returned 404; trying next candidate.", url);
                    continue;
                }

                var text = await res.Content.ReadAsStringAsync(ct);
                if (!res.IsSuccessStatusCode)
                    throw new InvalidOperationException($"Enrollment failed ( {(int)res.StatusCode} ): {text}");

                var (token, agentIdStr, deviceIdStr) = ParseEnrollResponse(text);
                if (string.IsNullOrWhiteSpace(token))
                    throw new InvalidOperationException("Enrollment succeeded but no agent token was returned.");

                _tokenStore.Save(new TokenStore.TokenData
                {
                    AgentToken = token,
                    AgentId = agentIdStr,
                    DeviceId = deviceIdStr ?? deviceId, // fall back to our request deviceId
                    RotateAfter = DateTime.UtcNow.AddDays(7)
                });

                _log.LogInformation("Enrolled as agentId={AgentId} deviceId={DeviceId}", agentIdStr, deviceIdStr);
                return;
            }
            catch (Exception ex)
            {
                lastErr = ex;
                _log.LogDebug(ex, "Enroll attempt failed.");
            }
        }

        throw new InvalidOperationException(
            $"Enrollment failed: {lastErr?.Message ?? "no enroll endpoint responded successfully"}",
            lastErr
        );
    }

    private static (string token, string? agentIdStr, string? deviceIdStr) ParseEnrollResponse(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        string? token = TryString(root, "agentToken")
                        ?? TryString(root, "token")
                        ?? TryString(root, "accessToken");

        string? agentIdStr = TryString(root, "agentId")
                             ?? TryNumberAsString(root, "agentId")
                             ?? TryNestedNumberAsString(root, "agent", "id")
                             ?? TryNestedString(root, "agent", "id");

        string? deviceIdStr = TryString(root, "deviceId")
                              ?? TryNumberAsString(root, "deviceId")
                              ?? TryNestedNumberAsString(root, "device", "id")
                              ?? TryNestedString(root, "device", "id");

        return (token ?? "", agentIdStr, deviceIdStr);

        static string? TryString(JsonElement el, string key)
            => el.TryGetProperty(key, out var p) && p.ValueKind == JsonValueKind.String ? p.GetString() : null;

        static string? TryNumberAsString(JsonElement el, string key)
        {
            if (el.TryGetProperty(key, out var p) && p.ValueKind == JsonValueKind.Number && p.TryGetInt64(out var n))
                return n.ToString();
            return null;
        }

        static string? TryNestedNumberAsString(JsonElement el, string objKey, string innerKey)
        {
            if (el.TryGetProperty(objKey, out var obj) && obj.ValueKind == JsonValueKind.Object)
            {
                if (obj.TryGetProperty(innerKey, out var p))
                {
                    if (p.ValueKind == JsonValueKind.Number && p.TryGetInt64(out var n)) return n.ToString();
                    if (p.ValueKind == JsonValueKind.String) return p.GetString();
                }
            }
            return null;
        }

        static string? TryNestedString(JsonElement el, string objKey, string innerKey)
        {
            if (el.TryGetProperty(objKey, out var obj) && obj.ValueKind == JsonValueKind.Object)
            {
                if (obj.TryGetProperty(innerKey, out var p) && p.ValueKind == JsonValueKind.String)
                    return p.GetString();
            }
            return null;
        }
    }

    private static string DeriveDeviceId(string hostname)
    {
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            try
            {
                using var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Cryptography");
                var mg = key?.GetValue("MachineGuid") as string;
                if (!string.IsNullOrWhiteSpace(mg)) return $"win-{mg}";
            }
            catch { /* ignore */ }
        }
        return hostname;
    }
}
