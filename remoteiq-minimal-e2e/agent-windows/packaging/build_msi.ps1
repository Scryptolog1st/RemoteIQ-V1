param(
  [string]$Configuration = "Release",
  [string]$Runtime = "win-x64",
  [string]$ProductName = "RemoteIQ Agent",
  [string]$Manufacturer = "RemoteIQ",
  [string]$Version = "0.1.0"
)

$ErrorActionPreference = "Stop"
$projDir = Join-Path $PSScriptRoot "RemoteIQ.Agent"
$publishDir = Join-Path $projDir "bin\$Configuration\net8.0\$Runtime\publish"

Write-Host "Publishing $ProductName..."
dotnet publish $projDir -c $Configuration -r $Runtime /p:PublishSingleFile=true /p:PublishTrimmed=true

$wxs = Join-Path $PSScriptRoot "Product.wxs"
if (-not (Test-Path $wxs)) {
  @"
<?xml version='1.0' encoding='UTF-8'?>
<Wix xmlns='http://schemas.microsoft.com/wix/2006/wi'>
  <Product Id='*' Name='RemoteIQ Agent' Language='1033' Version='$Version' Manufacturer='$Manufacturer' UpgradeCode='7D8E2E7A-2D7D-4E2B-8A8B-7D0246C7A111'>
    <Package InstallerVersion='500' Compressed='yes' InstallScope='perMachine' />
    <MediaTemplate EmbedCab='yes' />

    <MajorUpgrade DowngradeErrorMessage='A newer version is already installed.' />
    <Feature Id='ProductFeature' Title='RemoteIQ Agent' Level='1'>
      <ComponentGroupRef Id='AppFiles' />
      <ComponentRef Id='SvcInstall' />
      <ComponentRef Id='StartMenuShortcut' />
    </Feature>

    <Directory Id='TARGETDIR' Name='SourceDir'>
      <Directory Id='ProgramFilesFolder'>
        <Directory Id='INSTALLDIR' Name='RemoteIQ'>
          <Directory Id='APPDIR' Name='Agent' />
        </Directory>
      </Directory>
      <Directory Id='ProgramMenuFolder'>
        <Directory Id='RemoteIQPrograms' Name='RemoteIQ' />
      </Directory>
    </Directory>

    <ComponentGroup Id='AppFiles' Directory='APPDIR'>
      <!-- Files will be harvested by heat.exe -->
    </ComponentGroup>

    <Component Id='SvcInstall' Guid='*' Directory='APPDIR'>
      <ServiceInstall Id='RemoteIQAgentService'
                      Type='ownProcess'
                      Name='RemoteIQAgent'
                      DisplayName='RemoteIQ Agent'
                      Description='RemoteIQ agent service'
                      Start='auto'
                      ErrorControl='normal'
                      Arguments=''
                      />
      <ServiceControl Id='StartRemoteIQAgent' Name='RemoteIQAgent' Start='install' Stop='both' Remove='uninstall' />
      <File Id='AgentExe' Source='#!PUBLISH!\RemoteIQ.Agent.exe' KeyPath='yes' />
    </Component>

    <Component Id='StartMenuShortcut' Guid='*' Directory='RemoteIQPrograms'>
      <Shortcut Id='StartMenuShortcutId'
                Name='RemoteIQ Agent Console'
                Description='Run the RemoteIQ Agent interactively'
                Target='[APPDIR]RemoteIQ.Agent.exe'
                WorkingDirectory='APPDIR' />
      <RemoveFolder Id='RemoveProgramsDir' Directory='RemoteIQPrograms' On='uninstall' />
      <RegistryValue Root='HKCU' Key='Software\RemoteIQ\Agent' Name='installed' Type='integer' Value='1' KeyPath='yes' />
    </Component>

  </Product>
</Wix>
"@ | Set-Content -LiteralPath $wxs -Encoding UTF8
}

# harvest files
$heatOut = Join-Path $PSScriptRoot "AppFiles.wxs"
& heat.exe dir $publishDir -cg AppFiles -gg -srd -sreg -dr APPDIR -var var.PublishDir -out $heatOut | Out-Null

# compile and link
$candleOut = Join-Path $PSScriptRoot "obj"
New-Item $candleOut -ItemType Directory -Force | Out-Null

$msi = Join-Path $PSScriptRoot "RemoteIQAgent.msi"
$env:PublishDir = $publishDir

Write-Host "Compiling..."
& candle.exe -dPublishDir=$publishDir -ext WixUtilExtension -out (Join-Path $candleOut '\') $wxs, $heatOut | Out-Null
Write-Host "Linking..."
& light.exe -ext WixUtilExtension -out $msi (Join-Path $candleOut '*.wixobj') | Out-Null

Write-Host "Built MSI: $msi"
