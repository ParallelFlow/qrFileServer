import socket, psutil, ipaddress

def get_ipv4_addr(port):
    """
    # Get all bindable ipv4 network addresses from all network interface

    :param port: Port used to checking binding with.
    :return: A list of ipv6 network addresses.
    """
    addresses = []
    for interface, addrs in psutil.net_if_addrs().items():
        for addr in addrs:
            if addr.family == socket.AF_INET:
                if is_bindable(addr.address, port):
                    addresses.append(addr.address)
    return addresses



def get_ipv6_addr(port):
    """
    # Get all bindable ipv6 network addresses from all network interface

    :param: Port to checking binding with
    :return: A list of ipv6 network addresses.
    """
    addresses = []
    for interface, addrs in psutil.net_if_addrs().items():
        for addr in addrs:
            if addr.family == socket.AF_INET6:
                cleaned_address = f'[{addr.address.split('%')[0]}]'
                if is_bindable(addr.address, port):
                    addresses.append(cleaned_address)
    return addresses


def get_socket_type(ip):
    ip_obj = ipaddress.ip_address(ip)
    if isinstance(ip_obj, ipaddress.IPv4Address):
        return socket.AF_INET
    elif isinstance(ip_obj, ipaddress.IPv6Address):
        return socket.AF_INET6


def is_bindable(address, port):
    soc = socket.socket(get_socket_type(address), socket.SOCK_STREAM)
    try:
        soc.bind((address, int(port)))
        return True
    except:
        pass
    return False


