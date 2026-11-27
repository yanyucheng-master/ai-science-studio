param(
    [Parameter(Mandatory)][ValidateRange(1, 2100000000)][int]$VersionCode,
    [Parameter(Mandatory)][ValidatePattern('^\d+\.\d+\.\d+$')][string]$VersionName
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$sdk = $env:ANDROID_HOME
$buildTools = Join-Path $sdk 'build-tools/36.1.0'
$platform = Join-Path $sdk 'platforms/android-35/android.jar'
$jdk = Join-Path $env:JAVA_HOME 'bin'
$keyDir = Join-Path $env:LOCALAPPDATA 'MasterLab/AndroidSigning'
$keyFile = Join-Path $keyDir 'public-release.p12'
$passwordFile = Join-Path $keyDir 'password.dpapi'
$certificate = '2458a1dfe83530ec876d259e58faa9f6e7a06a44abd20272954928cfa9310aeb'
$publish = Join-Path $repo 'web/android'
$latest = Join-Path $publish 'latest.json'
$filename = "master-lab-$VersionCode.apk"
$publishedApk = Join-Path $publish $filename
if ((Test-Path $latest) -and (Get-Content -Raw $latest | ConvertFrom-Json).versionCode -ge $VersionCode) {
    throw 'Choose a versionCode greater than the published version.'
}
if (Test-Path $publishedApk) { throw "APK already exists: $filename" }
foreach ($required in @($platform, $buildTools, $keyFile, $passwordFile)) {
    if (!(Test-Path -LiteralPath $required)) { throw "Missing build input: $required" }
}
function Invoke-BuildTool([string]$Tool, [string[]]$Arguments) {
    & $Tool @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Build tool failed ($LASTEXITCODE): $Tool" }
}

$tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\', '/')
$work = Join-Path $tempRoot ('master-lab-apk-' + [guid]::NewGuid().ToString('N'))
$null = New-Item -ItemType Directory -Path $work
try {
    $res = Join-Path $work 'res'
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'res') -Destination $res -Recurse
    $iconDir = New-Item -ItemType Directory -Path (Join-Path $res 'drawable-nodpi')
    Copy-Item (Join-Path $repo 'web/assets/brand/orbit-flask-2026-10-04/icon-192.png') (Join-Path $iconDir 'lab_icon.png')
    $compiled = Join-Path $work 'resources.zip'
    $generated = New-Item -ItemType Directory -Path (Join-Path $work 'generated')
    $classes = New-Item -ItemType Directory -Path (Join-Path $work 'classes')
    $dex = New-Item -ItemType Directory -Path (Join-Path $work 'dex')
    $unsigned = Join-Path $work 'unsigned.apk'
    $aligned = Join-Path $work 'aligned.apk'
    $signed = Join-Path $work $filename
    $classesJar = Join-Path $work 'classes.jar'
    $aapt = Join-Path $buildTools 'aapt2.exe'
    $java = Join-Path $jdk 'java.exe'
    $jar = Join-Path $jdk 'jar.exe'
    $signer = Join-Path $buildTools 'lib/apksigner.jar'

    $assets = Join-Path $work 'assets'
    $webFiles = Invoke-BuildTool 'git' @('-C',$repo,'-c','core.quotepath=false','ls-files','--','web',':(exclude)web/android/**')
    foreach ($tracked in $webFiles) {
        $target = Join-Path $assets $tracked.Substring(4)
        $null = [IO.Directory]::CreateDirectory((Split-Path $target -Parent))
        [IO.File]::Copy((Join-Path $repo $tracked), $target)
    }
    $homePage = Join-Path $assets 'index.html'
    $html = [IO.File]::ReadAllText($homePage)
    $html = [regex]::Replace($html, '(?m)^.*https://fonts\.g(?:oogleapis|static)\.com[^<\r\n]*.*\r?\n', '')
    if (!$html.Contains('</body>')) { throw 'Missing experiment entry page' }
    $html = $html.Replace('</body>', '<script src="android-app.js"></script></body>')
    [IO.File]::WriteAllText($homePage, $html, [Text.UTF8Encoding]::new($false))
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'android-app.js') -Destination $assets

    Invoke-BuildTool $aapt @('compile','--dir',$res,'-o',$compiled)
    Invoke-BuildTool $aapt @('link','-I',$platform,'--manifest',(Join-Path $PSScriptRoot 'AndroidManifest.xml'),
        '--min-sdk-version','23','--target-sdk-version','35','--version-code',"$VersionCode",
        '--version-name',$VersionName,'-A',$assets,'--java',$generated.FullName,'-o',$unsigned,$compiled)
    $sources = @(Get-ChildItem -Path (Join-Path $PSScriptRoot 'src'),$generated.FullName -Filter '*.java' -Recurse |
        ForEach-Object { $_.FullName })
    $bootClasspath = $platform + [IO.Path]::PathSeparator + (Join-Path $buildTools 'core-lambda-stubs.jar')
    Invoke-BuildTool (Join-Path $jdk 'javac.exe') (@('-encoding','UTF-8','-source','8','-target','8',
        '-bootclasspath',$bootClasspath,'-d',$classes.FullName) + $sources)
    Invoke-BuildTool $jar @('cf',$classesJar,'-C',$classes.FullName,'.')
    Invoke-BuildTool $java @('-cp',(Join-Path $buildTools 'lib/d8.jar'),'com.android.tools.r8.D8',
        '--release','--min-api','23','--lib',$platform,'--output',$dex.FullName,$classesJar)
    # Preserve the resource entries produced by aapt2. In particular, resources.arsc must stay uncompressed.
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [IO.Compression.ZipFile]::Open($unsigned, [IO.Compression.ZipArchiveMode]::Update)
    try {
        $null = [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, (Join-Path $dex 'classes.dex'), 'classes.dex')
    } finally { $zip.Dispose() }
    Invoke-BuildTool (Join-Path $buildTools 'zipalign.exe') @('-f','4',$unsigned,$aligned)

    $sealed = Get-Content -LiteralPath $passwordFile -Raw | ConvertTo-SecureString
    $credential = New-Object System.Management.Automation.PSCredential('public-release', $sealed)
    $env:MASTERLAB_ANDROID_STORE_PASS = $credential.GetNetworkCredential().Password
    try {
        Invoke-BuildTool $java @('-jar',$signer,'sign','--ks',$keyFile,'--ks-key-alias','public-release',
            '--ks-pass','env:MASTERLAB_ANDROID_STORE_PASS','--v4-signing-enabled','false','--out',$signed,$aligned)
    } finally { Remove-Item Env:MASTERLAB_ANDROID_STORE_PASS -ErrorAction SilentlyContinue }
    $verification = Invoke-BuildTool $java @('-jar',$signer,'verify','--verbose','--print-certs',$signed)
    if ($verification -notcontains "Signer #1 certificate SHA-256 digest: $certificate") {
        throw 'APK certificate does not match the public Android release signer.'
    }
    Invoke-BuildTool (Join-Path $buildTools 'zipalign.exe') @('-c','4',$signed)
    $metadata = [ordered]@{
        packageName = 'cn.masterlab.publicdemo'
        versionCode = $VersionCode
        versionName = $VersionName
        apk = $filename
        sizeBytes = (Get-Item -LiteralPath $signed).Length
        sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $signed).Hash.ToLowerInvariant()
    }
    $null = New-Item -ItemType Directory -Force -Path $publish
    $manifestTemp = Join-Path $work 'latest.json'
    [IO.File]::WriteAllText($manifestTemp, (($metadata | ConvertTo-Json) + [Environment]::NewLine), [Text.UTF8Encoding]::new($false))
    [IO.File]::Copy($signed, $publishedApk, $false)
    Copy-Item -LiteralPath $manifestTemp -Destination $latest -Force
    Write-Output "Signed $filename ($VersionName), SHA-256 $($metadata.sha256)"
} finally {
    $resolved = (Resolve-Path -LiteralPath $work).ProviderPath
    if ((Split-Path $resolved -Parent) -eq $tempRoot -and (Split-Path $resolved -Leaf) -match '^master-lab-apk-[0-9a-f]{32}$') {
        Remove-Item -LiteralPath $resolved -Recurse -Force
    }
}
