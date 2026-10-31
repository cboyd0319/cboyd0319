#!/usr/bin/env bash
set -euo pipefail

version="7.1.2-34"
sha256="55fe0ec246245b46c429f9e6bc65294ad4a78a66b88abd9817971ca157856323"
url="https://github.com/ImageMagick/ImageMagick/releases/download/${version}/ImageMagick-${version}.tar.xz"
prefix="${RUNNER_TEMP:-${PWD}/.tools}/ImageMagick-${version}"

# Build from source to require rsvg for this repo's SVG text.
verify_install() {
  local output
  output="$("${prefix}/bin/magick" -version)"
  if [[ "$(sed -n 's/^Version: ImageMagick \([^ ]*\).*/\1/p' <<< "$output")" != "$version" ]]; then
    echo "ImageMagick $version required" >&2
    return 1
  fi
  for delegate in freetype png rsvg; do
    if ! grep '^Delegates ' <<< "$output" | grep -qw "$delegate"; then
      echo "ImageMagick $version missing required $delegate delegate" >&2
      return 1
    fi
  done
  printf '%s\n' "$output"
}

if [[ -x "${prefix}/bin/magick" ]]; then
  verify_install
  echo "${prefix}/bin" >> "${GITHUB_PATH:-/dev/null}"
  exit 0
fi

# Ubuntu 26.04's current production packages; keep both CI callers here.
source /etc/os-release
if [[ "$ID" != ubuntu || "$VERSION_ID" != 26.04 ]]; then
  echo "ImageMagick CI build requires Ubuntu 26.04" >&2
  exit 1
fi
privilege=()
if (( EUID != 0 )); then privilege=(sudo); fi
"${privilege[@]}" apt-get update
"${privilege[@]}" apt-get install -y --no-install-recommends \
  build-essential=12.12ubuntu2.26.04.2 \
  ca-certificates=20260816ubuntu0.26.04.1 \
  curl=8.18.0-1ubuntu2.8 \
  libfontconfig1-dev=2.17.1-3ubuntu1 \
  libfreetype-dev=2.14.2+dfsg-1ubuntu0.2 \
  libpng-dev=1.6.57-1ubuntu0.1 \
  librsvg2-dev=2.61.3+dfsg-3ubuntu0.1 \
  pkg-config=2.5.1-4 \
  xz-utils=5.8.3-1ubuntu0.1 \
  zlib1g-dev=1:1.3.dfsg+really1.3.1-1ubuntu3.2

tmpdir="$(mktemp -d)"
trap 'rm -rf "${tmpdir}"' EXIT
archive="${tmpdir}/ImageMagick-${version}.tar.xz"

curl -fsSL "${url}" -o "${archive}"
printf '%s  %s\n' "${sha256}" "${archive}" | sha256sum -c -
tar -xJf "${archive}" -C "${tmpdir}"

cd "${tmpdir}/ImageMagick-${version}"
./configure \
  --prefix="${prefix}" \
  --disable-dependency-tracking \
  --without-perl \
  --with-fontconfig=yes \
  --with-freetype=yes \
  --with-png=yes \
  --with-rsvg=yes
make -j"$(nproc)"
make install

verify_install
echo "${prefix}/bin" >> "${GITHUB_PATH:-/dev/null}"
