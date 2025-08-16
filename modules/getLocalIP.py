import socket, psutil

def get_ipv4_addr():
    """
    # Get all ipv4 network addresses from all network interface

    :return: A list of ipv4 network addresses.
    """
    addresses = []
    for interface, addrs in psutil.net_if_addrs().items():
        for addr in addrs:
            if addr.family == socket.AF_INET:
                addresses.append(addr.address)
    return addresses



def get_ipv6_addr():
    """
    # Get all ipv6 network addresses from all network interface

    :return: A list of ipv6 network addresses.
    """
    addresses = []
    for interface, addrs in psutil.net_if_addrs().items():
        for addr in addrs:
            if addr.family == socket.AF_INET6:
                addresses.append(addr.address)
    return addresses


