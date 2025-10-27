namespace RemoteIQ.Agent.Models;

public sealed class UpdateManifest
{
    public string Version { get; set; } = "";
    public string Sha256Base64 { get; set; } = "";
    public string? SignatureBase64 { get; set; } = null;
    public string Url { get; set; } = "";
}
