using System.Diagnostics;
using System.Net.Http.Json;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RemoteIQ.Agent.Models;

namespace RemoteIQ.Agent.Services;

public sealed class TaskWorker : BackgroundService
{
    private readonly ConfigService _cfg;
    private readonly PinnedHttpClientFactory _httpFactory;
    private readonly CryptoService _crypto;
    private readonly ILogger<TaskWorker> _log;

    public TaskWorker(ConfigService cfg, PinnedHttpClientFactory http, CryptoService crypto, ILogger<TaskWorker> log)
    {
        _cfg = cfg; _httpFactory = http; _crypto = crypto; _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (string.IsNullOrEmpty(_cfg.Current.AgentId) || string.IsNullOrEmpty(_cfg.Current.AgentKey))
                {
                    await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
                    continue;
                }

                var http = _httpFactory.Create();
                var url = $"{_cfg.Current.ApiBaseUrl.TrimEnd('/')}/api/agents/{_cfg.Current.AgentId}/tasks/next";
                using var req = new HttpRequestMessage(HttpMethod.Post, url);
                req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _cfg.Current.AgentKey);
                var resp = await http.SendAsync(req, stoppingToken);
                if (!resp.IsSuccessStatusCode)
                {
                    await Task.Delay(TimeSpan.FromSeconds(_cfg.Current.PollIntervals.TaskPollSeconds), stoppingToken);
                    continue;
                }

                var task = await resp.Content.ReadFromJsonAsync<TaskEnvelope>(cancellationToken: stoppingToken);
                if (task is null || string.IsNullOrEmpty(task.TaskId))
                {
                    await Task.Delay(TimeSpan.FromSeconds(_cfg.Current.PollIntervals.TaskPollSeconds), stoppingToken);
                    continue;
                }

                if (_cfg.Current.Security.RequireSignedTasks)
                {
                    var ok = _crypto.VerifyTaskSignature(new { task.TaskId, task.Type, task.PayloadBase64 }, task.SignatureBase64);
                    if (!ok)
                    {
                        _log.LogWarning("Rejected unsigned/invalid task {TaskId}", task.TaskId);
                        await Ack(task.TaskId, new TaskResult
                        {
                            TaskId = task.TaskId,
                            ExitCode = 403,
                            StdoutBase64 = "",
                            StderrBase64 = Encode("Signature invalid"),
                            DurationMs = 0
                        }, stoppingToken);
                        continue;
                    }
                }

                var sw = Stopwatch.StartNew();
                var result = await ExecuteTaskAsync(task, stoppingToken);
                result.DurationMs = sw.ElapsedMilliseconds;
                await Ack(task.TaskId, result, stoppingToken);
            }
            catch (Exception ex)
            {
                _log.LogDebugThrottled("tasks", TimeSpan.FromMinutes(1), "Task loop error: {Msg}", ex.Message);
            }

            await Task.Delay(TimeSpan.FromSeconds(_cfg.Current.PollIntervals.TaskPollSeconds), stoppingToken);
        }
    }

    private static async Task<TaskResult> ExecuteTaskAsync(TaskEnvelope t, CancellationToken ct)
    {
        switch (t.Type.ToLowerInvariant())
        {
            case "powershell":
                return await RunProcess("powershell.exe", "-NoProfile -ExecutionPolicy Bypass -Command -", Decode(t.PayloadBase64));
            case "cmd":
                return await RunProcess("cmd.exe", "/Q /C -", Decode(t.PayloadBase64));
            default:
                return new TaskResult
                {
                    TaskId = t.TaskId,
                    ExitCode = 400,
                    StdoutBase64 = "",
                    StderrBase64 = Encode($"Unknown task type: {t.Type}"),
                    DurationMs = 0
                };
        }
    }

    private static async Task<TaskResult> RunProcess(string file, string args, string stdin)
    {
        var psi = new System.Diagnostics.ProcessStartInfo
        {
            FileName = file,
            Arguments = args.Replace(" -", " ").Trim(),
            UseShellExecute = false,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true
        };
        using var p = new System.Diagnostics.Process { StartInfo = psi };
        p.Start();
        if (!string.IsNullOrEmpty(stdin))
        {
            await p.StandardInput.WriteAsync(stdin);
            p.StandardInput.Close();
        }
        var stdout = await p.StandardOutput.ReadToEndAsync();
        var stderr = await p.StandardError.ReadToEndAsync();
        await p.WaitForExitAsync();

        return new TaskResult
        {
            TaskId = "",
            ExitCode = p.ExitCode,
            StdoutBase64 = Encode(stdout),
            StderrBase64 = Encode(stderr),
            DurationMs = 0
        };
    }

    private async Task Ack(string taskId, TaskResult result, CancellationToken ct)
    {
        var http = _httpFactory.Create();
        var url = $"{_cfg.Current.ApiBaseUrl.TrimEnd('/')}/api/agents/{_cfg.Current.AgentId}/tasks/{taskId}/complete";
        using var req = new HttpRequestMessage(HttpMethod.Post, url);
        req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _cfg.Current.AgentKey);
        result.TaskId = taskId;
        req.Content = JsonContent.Create(result);
        var resp = await http.SendAsync(req, ct);
        resp.EnsureSuccessStatusCode();
    }

    private static string Encode(string s) => Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(s));
    private static string Decode(string b64) => string.IsNullOrEmpty(b64) ? "" : System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(b64));
}
