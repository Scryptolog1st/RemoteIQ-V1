namespace RemoteIQ.Agent.Models;

public sealed class EnrollmentRequest
{
    public string Hostname { get; set; } = "";
    public string OsVersion { get; set; } = "";
    public string Architecture { get; set; } = "";
    public string Username { get; set; } = "";
    public string AgentGroup { get; set; } = "default";
}

public sealed class EnrollmentResponse
{
    public string AgentId { get; set; } = "";
    public string AgentKey { get; set; } = "";
}
