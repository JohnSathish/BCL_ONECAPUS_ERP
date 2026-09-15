# Shared helper: pick the ERP compose network, not Koha edge.
# Nginx is often on both koha_nginx_edge and nep-erp_default. Concatenating
# those names produces a fake network Docker cannot attach to.
pick_erp_docker_net() {
  local cid="${1:-}"
  local fallback="${2:-nep-erp_default}"
  local nets net
  if [[ -n "${cid}" ]]; then
    nets="$(docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' "${cid}" 2>/dev/null || true)"
  fi
  for net in ${nets}; do
    case "${net}" in
      koha_nginx_edge) continue ;;
      *_default)
        printf '%s\n' "${net}"
        return 0
        ;;
    esac
  done
  for net in ${nets}; do
    [[ "${net}" == koha_nginx_edge ]] && continue
    printf '%s\n' "${net}"
    return 0
  done
  printf '%s\n' "${fallback}"
}
