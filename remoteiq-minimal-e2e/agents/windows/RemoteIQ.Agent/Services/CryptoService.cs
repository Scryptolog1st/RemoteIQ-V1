using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Logging;

namespace RemoteIQ.Agent.Services;

public sealed class CryptoService
{
    private readonly ILogger<CryptoService> _log;
    private RSA? _rsa;

    public CryptoService(ConfigService config, ILogger<CryptoService> log)
    {
        _log = log;
        var pem = config.Current.Security.RsaPublicKeyPem?.Trim();
        if (!string.IsNullOrWhiteSpace(pem))
        {
            try
            {
                _rsa = RSA.Create();
                _rsa.ImportFromPem(pem);
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Failed to import RSA public key PEM.");
            }
        }
    }

    public bool VerifyTaskSignature(object taskEnvelope, string? signatureBase64)
    {
        if (_rsa is null) return false;
        if (string.IsNullOrEmpty(signatureBase64)) return false;

        try
        {
            var json = System.Text.Json.JsonSerializer.Serialize(taskEnvelope, new System.Text.Json.JsonSerializerOptions
            {
                WriteIndented = false
            });
            var data = Encoding.UTF8.GetBytes(json);
            var sig = Convert.FromBase64String(signatureBase64);
            return _rsa.VerifyData(data, sig, HashAlgorithmName.SHA256, RSASignaturePadding.Pss);
        }
        catch
        {
            return false;
        }
    }

    public bool VerifyBlob(string canonical, string signatureBase64)
    {
        if (_rsa is null) return false;
        try
        {
            var data = Encoding.UTF8.GetBytes(canonical);
            var sig = Convert.FromBase64String(signatureBase64);
            return _rsa.VerifyData(data, sig, HashAlgorithmName.SHA256, RSASignaturePadding.Pss);
        }
        catch
        {
            return false;
        }
    }
}
