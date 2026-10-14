#!/usr/bin/env bash
# Downloads the free, local text-to-speech models (no API keys needed).
#   Kokoro-82M (Apache-2.0)  ~350 MB  — default narrator
#   Piper voices (see each .onnx.json for its licence) — lightweight alternative
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p models/kokoro models/piper

fetch() { # url dest
  if [ -s "$2" ]; then echo "  have $2"; return; fi
  echo "  downloading $2"
  curl -fL --retry 4 --retry-delay 3 -o "$2.part" "$1" && mv "$2.part" "$2"
}

echo "Kokoro:"
fetch https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx models/kokoro/kokoro-v1.0.onnx
fetch https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin models/kokoro/voices-v1.0.bin

echo "Piper:"
for v in en/en_US/ryan/high/en_US-ryan-high en/en_US/lessac/high/en_US-lessac-high en/en_GB/northern_english_male/medium/en_GB-northern_english_male-medium; do
  n=$(basename "$v")
  fetch "https://huggingface.co/rhasspy/piper-voices/resolve/main/$v.onnx" "models/piper/$n.onnx"
  fetch "https://huggingface.co/rhasspy/piper-voices/resolve/main/$v.onnx.json" "models/piper/$n.onnx.json"
done
echo "Models ready."
