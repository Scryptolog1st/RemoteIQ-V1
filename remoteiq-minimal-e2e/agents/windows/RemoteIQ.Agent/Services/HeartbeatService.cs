using System.Net.Http.Json;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace RemoteIQ.Agent.Services;

public sealed class HeartbeatService : BackgroundService
{
    private readonly ConfigService _cfg;
    private readonly PinnedHttpClientFactory _httpFactory;
    private readonly ILogger<HeartbeatService> _log;

    public HeartbeatService(ConfigService cfg, PinnedHttpClientFactory httpFactory, ILogger<HeartbeatService> log)
    {
        _cfg = cfg; _httpFactory = httpFactory; _log = log;
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
                var url = $"{_cfg.Current.ApiBaseUrl.TrimEnd('/')}/api/agents/{_cfg.Current.AgentId}/heartbeat";
                using var req = new HttpRequestMessage(HttpMethod.Post, url);
                req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _cfg.Current.AgentKey);
                var payload = new { ts = DateTimeOffset.UtcNow.ToUnixTimeSeconds() };
                req.Content = JsonContent.Create(payload);
                var resp = await http.SendAsync(req, stoppingToken);
                resp.EnsureSuccessStatusCode();
            }
            catch (Exception ex)
            {
                _log.LogDebugThrottled("hb", TimeSpan.FromMinutes(1), "Heartbeat error: {Msg}", ex.Message);
            }

            await Task.Delay(TimeSpan.FromSeconds(_cfg.Current.PollIntervals.HeartbeatSeconds), stoppingToken);
        }
    }
}
