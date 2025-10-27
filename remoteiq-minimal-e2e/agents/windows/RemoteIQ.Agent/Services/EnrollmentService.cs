using System.Net.Http.Json;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RemoteIQ.Agent.Models;

namespace RemoteIQ.Agent.Services;

public sealed class EnrollmentService : BackgroundService
{
    private readonly ConfigService _config;
    private readonly PinnedHttpClientFactory _httpFactory;
    private readonly ILogger<EnrollmentService> _log;

    public EnrollmentService(ConfigService cfg, PinnedHttpClientFactory http, ILogger<EnrollmentService> log)
    {
        _config = cfg; _httpFactory = http; _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            if (!string.IsNullOrEmpty(_config.Current.AgentId) && !string.IsNullOrEmpty(_config.Current.AgentKey))
                return;

            var http = _httpFactory.Create();
            try
            {
                var body = new EnrollmentRequest
                {
                    Hostname = Environment.MachineName,
                    OsVersion = Environment.OSVersion.ToString(),
                    Architecture = Environment.Is64BitOperatingSystem ? "x64" : "x86",
                    Username = Environment.UserName,
                    AgentGroup = _config.Current.AgentGroup
                };

                var url = $"{_config.Current.ApiBaseUrl.TrimEnd('/')}/api/agents/enroll";
                var resp = await http.PostAsJsonAsync(url, body, stoppingToken);
                resp.EnsureSuccessStatusCode();
                var er = await resp.Content.ReadFromJsonAsync<EnrollmentResponse>(cancellationToken: stoppingToken)
                         ?? throw new InvalidOperationException("Empty enrollment response");

                _config.Current.AgentId = er.AgentId;
                _config.Current.AgentKey = er.AgentKey;
                _config.Save(_config.Current);

                _log.LogInformation("Enrollment successful: {AgentId}", er.AgentId);
                return;
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Enrollment failed; retry in 2 minutes");
                await Task.Delay(TimeSpan.FromMinutes(2), stoppingToken);
            }
        }
    }
}
