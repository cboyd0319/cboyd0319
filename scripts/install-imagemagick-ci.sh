#!/usr/bin/env bash
set -euo pipefail

version="7.1.2-25"
sha256="ff33d227d2e1744327280e956ec9f7abaebbd8f48277d16cdad906e05e4794b6"
url="https://github.com/ImageMagick/ImageMagick/archive/refs/tags/${version}.tar.gz"
prefix="${RUNNER_TEMP:-${PWD}/.tools}/ImageMagick-${version}"

# Official 7.1.2-25 Linux AppImages omit the rsvg delegate and render this
# repo's SVG text incorrectly under MSVG, so CI builds the pinned source.
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

tmpdir="$(mktemp -d)"
trap 'rm -rf "${tmpdir}"' EXIT
archive="${tmpdir}/ImageMagick-${version}.tar.gz"

curl -fsSL "${url}" -o "${archive}"
printf '%s  %s\n' "${sha256}" "${archive}" | sha256sum -c -
tar -xzf "${archive}" -C "${tmpdir}"

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
