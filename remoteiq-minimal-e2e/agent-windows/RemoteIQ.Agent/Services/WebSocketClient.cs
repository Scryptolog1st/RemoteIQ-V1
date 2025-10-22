using System.Diagnostics;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RemoteIQ.Agent.Models;

namespace RemoteIQ.Agent.Services;

public sealed class WebSocketClient : BackgroundService
{
    private readonly ILogger<WebSocketClient> _logger;
    private readonly AgentConfigStore _store;
    private readonly string _baseUrl;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public WebSocketClient(ILogger<WebSocketClient> logger, AgentConfigStore store)
    {
        _logger = logger;
        _store = store;
        _baseUrl = (Environment.GetEnvironmentVariable("REMOTEIQ_URL") ?? "http://localhost:3001").TrimEnd('/');
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("WebSocket worker starting...");
        while (!stoppingToken.IsCancellationRequested)
        {
            ClientWebSocket? ws = null;
            try
            {
                var cfg = await _store.LoadAsync();
                if (cfg is null || string.IsNullOrWhiteSpace(cfg.AgentToken))
                {
                    _logger.LogInformation("No agent config yet; waiting 2s...");
                    await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken);
                    continue;
                }

                ws = new ClientWebSocket();
                // Keep header for upstream auth…
                ws.Options.SetRequestHeader("Authorization", $"Bearer {cfg.AgentToken}");

                // …and ALSO pass token in query for the Nest gateway (handshake.query.token).
                var wsUri = BuildAgentWsUri(cfg.AgentToken);
                _logger.LogInformation("Connecting to {Url}", wsUri);
                await ws.ConnectAsync(wsUri, stoppingToken);
                _logger.LogInformation("WebSocket connected.");

                // Announce + subscribe (unchanged)
                await SendAsync(ws, new
                {
                    type = "agent.hello",
                    agentId = cfg.AgentId,
                    hostname = Environment.MachineName,
                    os = "windows",
                    arch = Environment.Is64BitProcess ? "x64" : "x86",
                    version = "0.1.0"
                }, stoppingToken);

                await SendAsync(ws, new { type = "hello", agentId = cfg.AgentId, hostname = Environment.MachineName, version = "0.1.0" }, stoppingToken);
                await SendAsync(ws, new { type = "subscribe", channel = $"agent:{cfg.AgentId}" }, stoppingToken);
                await SendAsync(ws, new { type = "subscribe", channel = "agents" }, stoppingToken);
                await SendAsync(ws, new
                {
                    type = "presence.update",
                    agentId = cfg.AgentId,
                    status = "online",
                    ts = NowMs(),
                    at = DateTimeOffset.UtcNow
                }, stoppingToken);

                // Heartbeat loop using NestJS {event,data}
                using var hbCts = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
                var hbTask = SendHeartbeatsAsync(ws, cfg.AgentId!, hbCts.Token);

                // Receive loop
                await ReceiveLoopAsync(ws, cfg, stoppingToken);

                hbCts.Cancel();
                try { await hbTask; } catch { /* ignore */ }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
            catch (WebSocketException wse)
            {
                _logger.LogWarning(wse, "WebSocket error; will retry in 2s");
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "WS loop error");
            }
            finally
            {
                if (ws is not null)
                {
                    try { await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "bye", CancellationToken.None); } catch { }
                    ws.Dispose();
                }
            }

            await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken);
        }
    }

    private Uri BuildAgentWsUri(string token)
    {
        var ub = new UriBuilder(_baseUrl.Replace("http", "ws"))
        {
            Path = "/ws/agent",
            Query = $"token={Uri.EscapeDataString(token)}" // critical for gateway
        };
        return ub.Uri;
    }

    // ------------------------
    // Heartbeats (NestJS shape)
    // ------------------------
    private async Task SendHeartbeatsAsync(ClientWebSocket ws, string agentId, CancellationToken ct)
    {
        await SendHeartbeatOnce(ws, agentId, ct); // immediate
        while (!ct.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(10), ct);
                await SendHeartbeatOnce(ws, agentId, ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { break; }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Heartbeat send failed");
            }
        }
    }

    private async Task SendHeartbeatOnce(ClientWebSocket ws, string agentId, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var ts = now.ToUnixTimeMilliseconds();

        // Minimal (some handlers bind only on event name)
        await SendEventAsync(ws, "heartbeat", data: null, ct);

        // Common: include data for convenience on the server side
        await SendEventAsync(ws, "heartbeat", new { agentId, ts, at = now }, ct);
    }

    // Helper to send { "event": "<name>", "data": <obj|null> }
    private async Task SendEventAsync(ClientWebSocket ws, string eventName, object? data, CancellationToken ct)
    {
        var obj = new { @event = eventName, data };
        var json = JsonSerializer.Serialize(obj, JsonOpts);
        _logger.LogDebug("WS => {Json}", json);
        var bytes = Encoding.UTF8.GetBytes(json);
        await ws.SendAsync(bytes, WebSocketMessageType.Text, true, ct);
    }

    private static long NowMs() => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

    // ------------------------
    // Receive & job handling
    // ------------------------
    private async Task ReceiveLoopAsync(ClientWebSocket ws, AgentConfig cfg, CancellationToken ct)
    {
        var buffer = new byte[64 * 1024];
        using var ms = new MemoryStream();

        while (ws.State == WebSocketState.Open && !ct.IsCancellationRequested)
        {
            ms.SetLength(0);
            WebSocketReceiveResult? r;
            do
            {
                r = await ws.ReceiveAsync(buffer, ct);
                if (r.MessageType == WebSocketMessageType.Close)
                {
                    _logger.LogInformation("WebSocket closing: {Status} {Desc}", r.CloseStatus, r.CloseStatusDescription);
                    return;
                }
                if (r.MessageType == WebSocketMessageType.Binary) continue;
                ms.Write(buffer, 0, r.Count);
            }
            while (!r.EndOfMessage);

            var json = Encoding.UTF8.GetString(ms.GetBuffer(), 0, (int)ms.Length);
            if (string.IsNullOrWhiteSpace(json)) continue;

            _logger.LogDebug("WS <= {Json}", json);
            await HandleMessageAsync(ws, cfg, json, ct);
        }
    }

    private async Task HandleMessageAsync(ClientWebSocket ws, AgentConfig cfg, string json, CancellationToken ct)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            // Nest-style {event,data}
            if (root.TryGetProperty("event", out var evt))
            {
                var ev = evt.GetString();
                if (string.Equals(ev, "ping", StringComparison.OrdinalIgnoreCase))
                {
                    await SendEventAsync(ws, "pong", new { ts = NowMs() }, ct);
                    return;
                }
            }

            // Also support {type:"..."} messages
            var type = root.TryGetProperty("type", out var t) ? t.GetString() : null;

            if (string.Equals(type, "ping", StringComparison.OrdinalIgnoreCase))
            {
                await SendAsync(ws, new { type = "pong", ts = NowMs() }, ct);
                return;
            }

            if (string.Equals(type, "job.dispatch", StringComparison.OrdinalIgnoreCase) && root.TryGetProperty("job", out var jobEl))
            {
                var job = jobEl.Deserialize<JobDispatch>(JsonOpts);
                if (job?.Id is null) return;
                await HandleJobAsync(ws, job, ct);
                return;
            }

            if (string.Equals(type, "run-script", StringComparison.OrdinalIgnoreCase))
            {
                var simple = root.Deserialize<LegacyRunScriptMessage>(JsonOpts);
                if (simple?.Id is null || simple.Payload is null) return;

                var job = new JobDispatch
                {
                    Id = simple.Id,
                    Type = "RUN_SCRIPT",
                    Payload = simple.Payload
                };
                await HandleJobAsync(ws, job, ct);
                return;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to handle message: {Json}", json);
        }
    }

    private async Task HandleJobAsync(ClientWebSocket ws, JobDispatch job, CancellationToken ct)
    {
        _logger.LogInformation("Job received: {JobId} ({Type})", job.Id, job.Type);

        if (!string.Equals(job.Type, "RUN_SCRIPT", StringComparison.OrdinalIgnoreCase) || job.Payload is null)
        {
            await SendAsync(ws, new
            {
                type = "job.result",
                jobId = job.Id,
                exitCode = 1,
                stdout = "",
                stderr = "Unsupported job type",
                durationMs = 0
            }, ct);
            return;
        }

        var sw = Stopwatch.StartNew();
        var (exitCode, stdout, stderr) = await RunPowershellAsync(job.Payload, ct);
        sw.Stop();

        await SendAsync(ws, new
        {
            type = "job.result",
            jobId = job.Id,
            exitCode,
            stdout,
            stderr,
            durationMs = sw.ElapsedMilliseconds
        }, ct);

        _logger.LogInformation("Job {JobId} finished with {ExitCode}", job.Id, exitCode);
    }

    private async Task SendAsync(ClientWebSocket ws, object payload, CancellationToken ct)
    {
        var json = JsonSerializer.Serialize(payload, JsonOpts);
        _logger.LogDebug("WS => {Json}", json);
        var bytes = Encoding.UTF8.GetBytes(json);
        await ws.SendAsync(bytes, WebSocketMessageType.Text, true, ct);
    }

    // Records used by dispatch handling
    public sealed record ScriptPayload
    {
        public string? Language { get; init; }
        public string? ScriptText { get; init; }
        public string[]? Args { get; init; }
        public Dictionary<string, string>? Env { get; init; }
        public int? TimeoutSec { get; init; }
    }

    public sealed record JobDispatch
    {
        public string? Id { get; init; }
        public string? Type { get; init; }
        public ScriptPayload? Payload { get; init; }
    }

    private sealed record LegacyRunScriptMessage
    {
        public string? Id { get; init; }
        public string? Type { get; init; }
        public ScriptPayload? Payload { get; init; }
    }

    // PowerShell runner
    private static string ResolvePwshOrWindowsPowerShell()
    {
        var candidates = new[]
        {
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "PowerShell", "7", "pwsh.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "PowerShell", "7-preview", "pwsh.exe"),
            "pwsh.exe",
            Path.Combine(Environment.SystemDirectory, "WindowsPowerShell", "v1.0", "powershell.exe"),
            "powershell.exe"
        };

        foreach (var p in candidates)
        {
            try
            {
                if (Path.IsPathRooted(p) && File.Exists(p)) return p;
            }
            catch { }
        }
        return "powershell.exe";
    }

    private async Task<(int exitCode, string stdout, string stderr)> RunPowershellAsync(ScriptPayload payload, CancellationToken outerCt)
    {
        if (!string.Equals(payload.Language, "powershell", StringComparison.OrdinalIgnoreCase))
            return (1, "", "Only PowerShell is supported.");

        var tempPath = Path.Combine(Path.GetTempPath(), $"riq_{Guid.NewGuid():N}.ps1");
        await File.WriteAllTextAsync(tempPath, payload.ScriptText ?? string.Empty, new UTF8Encoding(false), outerCt);

        var exe = ResolvePwshOrWindowsPowerShell();
        var psi = new ProcessStartInfo
        {
            FileName = exe,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        psi.ArgumentList.Add("-NoLogo");
        psi.ArgumentList.Add("-NoProfile");
        psi.ArgumentList.Add("-NonInteractive");
        psi.ArgumentList.Add("-ExecutionPolicy");
        psi.ArgumentList.Add("Bypass");
        psi.ArgumentList.Add("-File");
        psi.ArgumentList.Add(tempPath);

        if (payload.Args is { Length: > 0 })
            foreach (var a in payload.Args) psi.ArgumentList.Add(a ?? "");

        if (payload.Env is not null)
            foreach (var kv in payload.Env) psi.Environment[kv.Key] = kv.Value ?? "";

        using var proc = new Process { StartInfo = psi, EnableRaisingEvents = true };
        var sbOut = new StringBuilder();
        var sbErr = new StringBuilder();
        var tcsExit = new TaskCompletionSource<int>(TaskCreationOptions.RunContinuationsAsynchronously);

        proc.OutputDataReceived += (_, e) => { if (e.Data is not null) sbOut.AppendLine(e.Data); };
        proc.ErrorDataReceived += (_, e) => { if (e.Data is not null) sbErr.AppendLine(e.Data); };
        proc.Exited += (_, __) => { try { tcsExit.TrySetResult(proc.ExitCode); } catch { } };

        try
        {
            if (!proc.Start()) return (1, "", "Failed to start PowerShell.");
            proc.BeginOutputReadLine();
            proc.BeginErrorReadLine();

            using var ctsTimeout = payload.TimeoutSec is > 0
                ? CancellationTokenSource.CreateLinkedTokenSource(outerCt)
                : null;

            if (ctsTimeout is not null)
                ctsTimeout.CancelAfter(TimeSpan.FromSeconds(payload.TimeoutSec!.Value));

            var ct = ctsTimeout?.Token ?? outerCt;
            using (ct.Register(() => { try { if (!proc.HasExited) proc.Kill(entireProcessTree: true); } catch { } }))
            {
                var exit = await tcsExit.Task;
                return (exit, sbOut.ToString(), sbErr.ToString());
            }
        }
        catch (OperationCanceledException)
        {
            return (124, sbOut.ToString(), sbErr.Length == 0 ? "Timed out / canceled" : sbErr.ToString());
        }
        catch (Exception ex)
        {
            return (1, sbOut.ToString(), "Exception: " + ex.Message);
        }
        finally
        {
            try { File.Delete(tempPath); } catch { }
        }
    }
}
