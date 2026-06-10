#!/usr/bin/env bash
set -euo pipefail

version="7.1.2-25"
sha256="c4ce2d982fbedf0347aeca804326308311d767c8da6a69e91ed39371f8de137b"
url="https://imagemagick.org/archive/releases/ImageMagick-${version}.tar.gz"
prefix="${RUNNER_TEMP:-${PWD}/.tools}/ImageMagick-${version}"

if [[ -x "${prefix}/bin/magick" ]]; then
  detected="$("${prefix}/bin/magick" -version | sed -n 's/^Version: ImageMagick \([^ ]*\).*/\1/p')"
  if [[ "${detected}" == "${version}" ]]; then
    echo "${prefix}/bin" >> "${GITHUB_PATH:-/dev/null}"
    "${prefix}/bin/magick" -version
    exit 0
  fi
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

echo "${prefix}/bin" >> "${GITHUB_PATH:-/dev/null}"
"${prefix}/bin/magick" -version
