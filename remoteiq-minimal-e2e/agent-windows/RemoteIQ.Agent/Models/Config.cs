// remoteiq-minimal-e2e/agent-windows/RemoteIQ.Agent/Models/Config.cs
using Microsoft.Extensions.Configuration;

namespace RemoteIQ.Agent.Models;

public class AgentConfig
{
    public string ApiBase { get; set; } = "http://localhost:3001";
    public string EnrollmentSecret { get; set; } = "dev-secret";
    public int PollIntervalSeconds { get; set; } = 30;
    public int InventoryIntervalMinutes { get; set; } = 30;
    public int LogTailCount { get; set; } = 100;
    public bool AllowHttpOnLocalhost { get; set; } = true;
    public int TopNProcesses { get; set; } = 5;

    public static AgentConfig From(IConfiguration cfg)
    {
        var c = new AgentConfig();
        cfg.GetSection("Agent").Bind(c);

        // Env overrides
        c.ApiBase = Environment.GetEnvironmentVariable("AGENT_API_BASE") ?? c.ApiBase;
        c.EnrollmentSecret = Environment.GetEnvironmentVariable("ENROLLMENT_SECRET") ?? c.EnrollmentSecret;
        if (int.TryParse(Environment.GetEnvironmentVariable("AGENT_POLL_INTERVAL_SEC"), out var s)) c.PollIntervalSeconds = s;

        return c;
    }
}
