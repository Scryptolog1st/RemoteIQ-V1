// remoteiq-minimal-e2e/agent-windows/RemoteIQ.Agent/Options/AgentOptions.cs
namespace RemoteIQ.Agent.Options;

public sealed class AgentOptions
{
    public string ApiBase { get; set; } = "http://localhost:3001";
    public string EnrollmentSecret { get; set; } = "";
    public int PollIntervalSeconds { get; set; } = 60;
    public int InventoryIntervalMinutes { get; set; } = 30;
}
