fn ipv4_octets(s: &str) -> Option<[u8; 4]> {
    let parts: Vec<&str> = s.split('.').collect();
    if parts.len() != 4 {
        return None;
    }
    let mut octets = [0u8; 4];
    for (index, part) in parts.iter().enumerate() {
        if part.is_empty() || part.len() > 3 || !part.chars().all(|c| c.is_ascii_digit()) {
            return None;
        }
        octets[index] = part.parse::<u8>().ok()?;
    }
    Some(octets)
}

pub(super) fn is_valid_ipv4(s: &str) -> bool {
    ipv4_octets(s).is_some()
}

pub(super) fn is_tailscale_ipv4(s: &str) -> bool {
    matches!(ipv4_octets(s), Some([100, second, _, _]) if (64..=127).contains(&second))
}

pub(super) fn is_rfc2544_benchmark_ipv4(s: &str) -> bool {
    matches!(ipv4_octets(s), Some([198, second, _, _]) if (18..=19).contains(&second))
}

pub(super) fn is_private_lan_ipv4(s: &str) -> bool {
    matches!(
        ipv4_octets(s),
        Some([10, _, _, _]) | Some([172, 16..=31, _, _]) | Some([192, 168, _, _])
    )
}

pub(super) fn parse_first_ipv4_line(output: &str) -> Option<String> {
    output
        .lines()
        .map(str::trim)
        .find(|line| is_valid_ipv4(line) && !is_rfc2544_benchmark_ipv4(line))
        .map(ToOwned::to_owned)
}

pub(super) fn parse_windows_private_default_route_ipv4(output: &str) -> Option<String> {
    output.lines().find_map(|line| {
        let columns: Vec<&str> = line.split_whitespace().collect();
        if columns.len() < 4 || columns[0] != "0.0.0.0" || columns[1] != "0.0.0.0" {
            return None;
        }
        let interface_ip = columns[3];
        is_private_lan_ipv4(interface_ip).then(|| interface_ip.to_string())
    })
}

pub(super) fn parse_first_tailscale_ipv4_from_ifconfig(output: &str) -> Option<String> {
    output.lines().find_map(|line| {
        let value = line.trim().strip_prefix("inet ")?;
        let ip = value.split_whitespace().next()?;
        is_tailscale_ipv4(ip).then(|| ip.to_string())
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ipv4_line_parser_skips_rfc2544_fake_ip_ranges() {
        assert_eq!(
            parse_first_ipv4_line("198.18.0.1\n192.168.0.101\n"),
            Some("192.168.0.101".to_string())
        );
        assert_eq!(parse_first_ipv4_line("198.19.255.254\n"), None);
    }

    #[test]
    fn ipv4_line_parser_keeps_tailscale_addresses() {
        assert_eq!(
            parse_first_ipv4_line("100.64.0.1\n"),
            Some("100.64.0.1".to_string())
        );
    }

    #[test]
    fn windows_default_route_parser_prefers_private_lan_over_fake_ip_route() {
        let routes = "0.0.0.0 0.0.0.0 198.18.0.2 198.18.0.1 0\n0.0.0.0 0.0.0.0 192.168.0.1 192.168.0.101 35\n";
        assert_eq!(
            parse_windows_private_default_route_ipv4(routes),
            Some("192.168.0.101".to_string())
        );
        assert_eq!(
            parse_windows_private_default_route_ipv4("0.0.0.0 0.0.0.0 198.18.0.2 198.18.0.1 0\n"),
            None
        );
    }
}
