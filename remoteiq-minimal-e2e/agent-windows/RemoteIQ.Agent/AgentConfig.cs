// remoteiq-minimal-e2e/agent-windows/RemoteIQ.Agent/AgentConfig.cs
using Microsoft.Extensions.Configuration;

namespace RemoteIQ.Agent;

public sealed class AgentConfig
{
    public string ApiBase { get; init; } = "http://localhost:3001";
    public string EnrollmentSecret { get; init; } = "";

    public static AgentConfig From(IConfiguration cfg)
    {
        var section = cfg.GetSection("Agent");
        return new AgentConfig
        {
            ApiBase = section["ApiBase"] ?? "http://localhost:3001",
            EnrollmentSecret = section["EnrollmentSecret"] ?? ""
        };
    }
}
