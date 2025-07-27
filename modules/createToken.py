import secrets, string

def generate_token(length: int = 16):
    """
    Generate a secure random alphanumeric token.

    :param length: Length of the token to generate (default: 16)
    :return: A random alphanumeric string
    """
    characters = string.ascii_letters + string.digits
    return ''.join(secrets.choice(characters) for i in range(length))

