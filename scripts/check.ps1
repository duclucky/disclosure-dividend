param([string]$Only = "")

$ErrorActionPreference = "Stop"
$env:PYTHONUTF8 = "1"
$Python = ".\.venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $Python)) {
  throw "Missing .venv. Create the Python 3.12 environment and install requirements-dev.txt."
}

function Assert-LastExitCode([string]$Step) {
  if ($LASTEXITCODE -ne 0) {
    throw "$Step failed with exit code $LASTEXITCODE"
  }
}

if ($Only -eq "" -or $Only -eq "lint") {
  & $Python scripts/ascii_contract_check.py
  Assert-LastExitCode "ASCII/header contract check"
  $Linter = ".\.venv\Scripts\genvm-lint.exe"
  if (Test-Path -LiteralPath $Linter) {
    & $Linter lint contracts/disclosure_dividend.py
    Assert-LastExitCode "GenVM AST lint"
    $TempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("disclosure-dividend-genvm-" + [System.Guid]::NewGuid().ToString())
    New-Item -ItemType Directory -Path $TempDir | Out-Null
    $TempContract = Join-Path $TempDir "disclosure_dividend_lint.py"
    $Source = Get-Content -LiteralPath "contracts/disclosure_dividend.py" -Raw
    $Source = $Source.Replace("class Contract(gl.Contract):", "class DisclosureDividend(gl.Contract):")
    Set-Content -LiteralPath $TempContract -Value $Source -Encoding ascii
    & $Linter check $TempContract
    $TempExit = $LASTEXITCODE
    Remove-Item -LiteralPath $TempContract -Force
    [System.IO.Directory]::Delete($TempDir, $true)
    if ($TempExit -ne 0) {
      throw "GenVM schema check failed with exit code $TempExit"
    }
  } elseif (Get-Command genvm-lint -ErrorAction SilentlyContinue) {
    genvm-lint lint contracts/disclosure_dividend.py
    Assert-LastExitCode "GenVM AST lint"
    $TempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("disclosure-dividend-genvm-" + [System.Guid]::NewGuid().ToString())
    New-Item -ItemType Directory -Path $TempDir | Out-Null
    $TempContract = Join-Path $TempDir "disclosure_dividend_lint.py"
    $Source = Get-Content -LiteralPath "contracts/disclosure_dividend.py" -Raw
    $Source = $Source.Replace("class Contract(gl.Contract):", "class DisclosureDividend(gl.Contract):")
    Set-Content -LiteralPath $TempContract -Value $Source -Encoding ascii
    genvm-lint check $TempContract
    $TempExit = $LASTEXITCODE
    Remove-Item -LiteralPath $TempContract -Force
    [System.IO.Directory]::Delete($TempDir, $true)
    if ($TempExit -ne 0) {
      throw "GenVM schema check failed with exit code $TempExit"
    }
  } else {
    throw "genvm-lint is not installed"
  }
}

if ($Only -eq "" -or $Only -eq "test") {
  & $Python -m pytest tests/direct tests/test_static_contract.py -v
  Assert-LastExitCode "Direct contract tests"
}

if ($Only -eq "" -or $Only -eq "deployment") {
  & $Python -m pytest tests/test_deployment_receipts.py -v
  Assert-LastExitCode "Deployment parser tests"
}

if ($Only -eq "") {
  npm --prefix frontend run lint
  Assert-LastExitCode "Frontend TypeScript"
  npm --prefix frontend run test
  Assert-LastExitCode "Frontend tests"
  npm --prefix frontend run build
  Assert-LastExitCode "Frontend production build"
}
