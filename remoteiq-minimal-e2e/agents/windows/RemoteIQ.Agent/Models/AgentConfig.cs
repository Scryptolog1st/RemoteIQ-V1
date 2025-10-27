namespace RemoteIQ.Agent.Models;

public sealed class AgentConfig
{
    public string ApiBaseUrl { get; set; } = "";
    public string AgentId { get; set; } = "";
    public string AgentKey { get; set; } = "";
    public string AgentGroup { get; set; } = "default";

    public PollIntervals PollIntervals { get; set; } = new();
    public SecurityConfig Security { get; set; } = new();
}

public sealed class PollIntervals
{
    public int HeartbeatSeconds { get; set; } = 30;
    public int TaskPollSeconds { get; set; } = 5;
    public int InventoryMinutes { get; set; } = 30;
    public int UpdateCheckMinutes { get; set; } = 30;
}

public sealed class SecurityConfig
{
    public bool RequireSignedTasks { get; set; } = true;
    public string RsaPublicKeyPem { get; set; } = "";
    public bool EnableCertPinning { get; set; } = false;
    public string[] PinnedSpkiSha256 { get; set; } = System.Array.Empty<string>();
}
