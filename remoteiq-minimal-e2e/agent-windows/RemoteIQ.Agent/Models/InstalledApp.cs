//remoteiq-minimal-e2e\agent-windows\RemoteIQ.Agent\Models\InstalledApp.cs

namespace RemoteIQ.Agent.Models
{
    public record InstalledApp(
        string DisplayName,
        string? Version,
        string? Publisher,
        string? InstallDate
    );
}
