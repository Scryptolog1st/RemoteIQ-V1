// remoteiq-minimal-e2e/agent-windows/RemoteIQ.Agent/Services/WebSocketClient.cs
using System.Diagnostics;
using System.Net.WebSockets;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using RemoteIQ.Agent.Models;            // AgentConfig.From(...)
using RemoteIQ.Agent.Services.Security; // TokenStore

namespace RemoteIQ.Agent.Services;

/// <summary>
/// Optional WebSocket client. Connects to ws(s)://{ApiBaseHost}/ws,
/// sends an agent_hello right after connect, then listens for messages.
/// Supports "job_run_script" and replies with "job_result".
/// </summary>
public class WebSocketClient : IAsyncDisposable
{
    private readonly ILogger<WebSocketClient> _log;
    private readonly IConfiguration _configuration;
    private readonly TokenStore _tokenStore;

    private ClientWebSocket? _ws;
    private Uri? _endpoint;

    private const string AgentVersion = "1.0.0.0";

    public WebSocketClient(
        ILogger<WebSocketClient> log,
        IConfiguration configuration,
        TokenStore tokenStore)
    {
        _log = log;
        _configuration = configuration;
        _tokenStore = tokenStore;
    }

    public async Task StartAsync(CancellationToken ct)
    {
        var cfg = AgentConfig.From(_configuration);

        if (!Uri.TryCreate(cfg.ApiBase, UriKind.Absolute, out var apiBase))
        {
            _log.LogDebug("WebSocketClient: ApiBase not a valid URI; skipping WS.");
            return;
        }

        var wsScheme =
            apiBase.Scheme.Equals("https", StringComparison.OrdinalIgnoreCase) ? "wss" :
            apiBase.Scheme.Equals("http", StringComparison.OrdinalIgnoreCase) ? "ws" : null;

        if (wsScheme is null)
        {
            _log.LogDebug("WebSocketClient: ApiBase scheme not http/https; skipping WS.");
            return;
        }

        _endpoint = new UriBuilder(apiBase)
        {
            Scheme = wsScheme,
            Path = "/ws",
            Query = ""
        }.Uri;

        var tokenData = _tokenStore.Load();
        var token = tokenData?.AgentToken;
        if (string.IsNullOrWhiteSpace(token))
        {
            _log.LogDebug("WebSocketClient: no token yet; skipping WS connect.");
            return;
        }

        _ws = new ClientWebSocket();
        _ws.Options.SetRequestHeader("Authorization", $"Bearer {token}");

        try
        {
            _log.LogInformation("WebSocketClient: connecting to {Endpoint}", _endpoint);
            await _ws.ConnectAsync(_endpoint, ct);

            // Send hello immediately after connecting
            await SendHelloAsync(tokenData, token, ct);

            // Start the receive loop (fire-and-forget)
            _ = Task.Run(() => ReceiveLoopAsync(ct), ct);
        }
        catch (Exception ex)
        {
            _log.LogDebug(ex, "WebSocketClient: connect failed; continuing without WS.");
            await DisposeAsync();
        }
    }

    private async Task SendHelloAsync(TokenStore.TokenData? tokenData, string jwt, CancellationToken ct)
    {
        if (_ws is not { State: WebSocketState.Open }) return;

        var agentId = !string.IsNullOrWhiteSpace(tokenData?.AgentId)
            ? tokenData!.AgentId!
            : (TryGetClaimFromJwt(jwt, "agentId", "agent_id", "aid", "agent") ?? "unknown");

        var deviceId = !string.IsNullOrWhiteSpace(tokenData?.DeviceId)
            ? tokenData!.DeviceId!
            : (TryGetClaimFromJwt(jwt, "deviceId", "device_id", "did", "device") ?? "unknown");

        var hello = new
        {
            t = "agent_hello",
            agentId,
            deviceId,
            hostname = Environment.MachineName,
            os = "windows",
            arch = RuntimeInformation.OSArchitecture.ToString().ToLowerInvariant(),
            version = AgentVersion
        };

        await SendJsonAsync(hello, ct);
        _log.LogInformation("WebSocketClient: sent agent_hello (agentId={AgentId}, deviceId={DeviceId})", agentId, deviceId);
    }

    private static string? TryGetClaimFromJwt(string jwt, params string[] keys)
    {
        try
        {
            var parts = jwt.Split('.');
            if (parts.Length < 2) return null;

            static string Pad(string s) => s + new string('=', (4 - s.Length % 4) % 4);
            var payloadJson = Encoding.UTF8.GetString(
                Convert.FromBase64String(Pad(parts[1].Replace('-', '+').Replace('_', '/')))
            );

            using var doc = JsonDocument.Parse(payloadJson);
            var root = doc.RootElement;

            foreach (var key in keys)
            {
                if (root.TryGetProperty(key, out var el))
                {
                    return el.ValueKind switch
                    {
                        JsonValueKind.String => el.GetString(),
                        JsonValueKind.Number => el.TryGetInt64(out var n) ? n.ToString() : el.ToString(),
                        _ => el.ToString()
                    };
                }
            }

            if (root.TryGetProperty("claims", out var claims) && claims.ValueKind == JsonValueKind.Object)
            {
                foreach (var key in keys)
                {
                    if (claims.TryGetProperty(key, out var el2))
                    {
                        return el2.ValueKind == JsonValueKind.String ? el2.GetString() : el2.ToString();
                    }
                }
            }
        }
        catch { }
        return null;
    }

    private async Task ReceiveLoopAsync(CancellationToken ct)
    {
        if (_ws is null) return;

        var buffer = new byte[256 * 1024];
        var sb = new StringBuilder();

        while (!ct.IsCancellationRequested && _ws.State == WebSocketState.Open)
        {
            try
            {
                sb.Clear();
                WebSocketReceiveResult? result;
                do
                {
                    result = await _ws.ReceiveAsync(new ArraySegment<byte>(buffer), ct);
                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        _log.LogInformation("WebSocketClient: server closed connection.");
                        await DisposeAsync();
                        return;
                    }
                    sb.Append(Encoding.UTF8.GetString(buffer, 0, result.Count));
                } while (!result.EndOfMessage);

                var text = sb.ToString();
                if (string.IsNullOrWhiteSpace(text)) continue;

                HandleInbound(text, ct);
            }
            catch (OperationCanceledException) { }
            catch (Exception ex)
            {
                _log.LogDebug(ex, "WebSocketClient: receive error; closing.");
                break;
            }
        }

        await DisposeAsync();
    }

    private void HandleInbound(string json, CancellationToken ct)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            var t = root.TryGetProperty("t", out var tEl) && tEl.ValueKind == JsonValueKind.String ? tEl.GetString() : null;
            if (string.IsNullOrEmpty(t)) return;

            if (t == "job_run_script")
            {
                // Expected payload:
                // { t, jobId, language: "powershell" | "bash", scriptText, args?, env?, timeoutSec? }
                var jobId = root.GetProperty("jobId").GetString() ?? "";
                var language = root.GetProperty("language").GetString() ?? "powershell";
                var scriptText = root.GetProperty("scriptText").GetString() ?? "";
                var args = root.TryGetProperty("args", out var aEl) && aEl.ValueKind == JsonValueKind.Array
                    ? aEl.EnumerateArray().Select(x => x.GetString() ?? "").ToArray()
                    : Array.Empty<string>();
                var env = root.TryGetProperty("env", out var eEl) && eEl.ValueKind == JsonValueKind.Object
                    ? eEl.EnumerateObject().ToDictionary(p => p.Name, p => p.Value.GetString() ?? "")
                    : new Dictionary<string, string>();
                var timeoutSec = root.TryGetProperty("timeoutSec", out var toEl) && toEl.TryGetInt32(out var to)
                    ? to
                    : 120;

                _ = Task.Run(async () =>
                {
                    var sw = Stopwatch.StartNew();
                    int exitCode;
                    string stdout, stderr;
                    try
                    {
                        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows) && language.Equals("powershell", StringComparison.OrdinalIgnoreCase))
                        {
                            (exitCode, stdout, stderr) = await RunPowerShellAsync(scriptText, args, env, TimeSpan.FromSeconds(timeoutSec), ct);
                        }
                        else
                        {
                            (exitCode, stdout, stderr) = await RunShellAsync(scriptText, args, env, TimeSpan.FromSeconds(timeoutSec), ct);
                        }
                    }
                    catch (Exception ex)
                    {
                        exitCode = -1;
                        stdout = "";
                        stderr = $"Agent exception: {ex.Message}";
                    }
                    sw.Stop();

                    var result = new
                    {
                        t = "job_result",
                        jobId,
                        exitCode,
                        stdout,
                        stderr,
                        durationMs = (long)sw.ElapsedMilliseconds,
                        status = exitCode == 0 ? "succeeded" : "failed"
                    };
                    await SendJsonAsync(result, CancellationToken.None);
                }, ct);
            }
        }
        catch (Exception ex)
        {
            _log.LogDebug(ex, "WebSocketClient: failed to handle inbound message");
        }
    }

    private async Task SendJsonAsync(object payload, CancellationToken ct)
    {
        if (_ws is not { State: WebSocketState.Open }) return;
        var json = JsonSerializer.Serialize(payload);
        var bytes = Encoding.UTF8.GetBytes(json);
        await _ws.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, ct);
    }

    private static async Task<(int exitCode, string stdout, string stderr)> RunPowerShellAsync(
        string scriptText,
        string[] args,
        Dictionary<string, string> env,
        TimeSpan timeout,
        CancellationToken ct)
    {
        // Use -NoProfile -NonInteractive for reliability; pass the script via -Command
        var psi = new ProcessStartInfo
        {
            FileName = "powershell.exe",
            Arguments = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -Command -",
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };

        foreach (var kv in env) psi.Environment[kv.Key] = kv.Value;

        using var proc = new Process { StartInfo = psi };
        proc.Start();

        await proc.StandardInput.WriteAsync(scriptText);
        await proc.StandardInput.FlushAsync();
        proc.StandardInput.Close();

        var stdoutTask = proc.StandardOutput.ReadToEndAsync();
        var stderrTask = proc.StandardError.ReadToEndAsync();

        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(timeout);

        var exited = await Task.Run(() => proc.WaitForExit((int)timeout.TotalMilliseconds), cts.Token);
        if (!exited)
        {
            try { proc.Kill(true); } catch { }
            return (124, "", "Timeout");
        }

        var stdout = await stdoutTask;
        var stderr = await stderrTask;
        return (proc.ExitCode, stdout, stderr);
    }

    private static async Task<(int exitCode, string stdout, string stderr)> RunShellAsync(
        string scriptText,
        string[] args,
        Dictionary<string, string> env,
        TimeSpan timeout,
        CancellationToken ct)
    {
        // Generic /bin/bash -c 'script'
        var psi = new ProcessStartInfo
        {
            FileName = "/bin/bash",
            Arguments = "-c \"$@\" bash _ " + EscapeForBash(scriptText),
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };

        foreach (var kv in env) psi.Environment[kv.Key] = kv.Value;

        using var proc = new Process { StartInfo = psi };
        proc.Start();

        var stdoutTask = proc.StandardOutput.ReadToEndAsync();
        var stderrTask = proc.StandardError.ReadToEndAsync();

        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(timeout);

        var exited = await Task.Run(() => proc.WaitForExit((int)timeout.TotalMilliseconds), cts.Token);
        if (!exited)
        {
            try { proc.Kill(true); } catch { }
            return (124, "", "Timeout");
        }

        var stdout = await stdoutTask;
        var stderr = await stderrTask;
        return (proc.ExitCode, stdout, stderr);
    }

    private static string EscapeForBash(string s)
        => s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("$", "\\$").Replace("`", "\\`");

    public async ValueTask DisposeAsync()
    {
        try
        {
            if (_ws is { State: WebSocketState.Open })
            {
                await _ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "bye", CancellationToken.None);
            }
        }
        catch { }
        finally
        {
            _ws?.Dispose();
            _ws = null;
        }
    }
}
