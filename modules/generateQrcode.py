import qrcode

def generate_unicode_qr(data: str):
    """
    Generate a text representation of a qrcode from an input.

    :param data: The string to encode
    :return: A string representation of a qrcode
    """
    # Create a QR code and make a matrix
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=1,
        border=1
    )
    qr.add_data(data)
    qr.make(fit=True)
    matrix = qr.get_matrix()

    height = len(matrix)
    width = len(matrix[0])

    # build unicode qrcode
    columns = []
    for y in range(0, height, 2):
        row_chars = []
        for x in range(width):
            # grab two pixels: upper and lower
            upperPixel = matrix[y][x]
            if y+1 < height: #handle if lowerPixel exist
                lowerPixel = matrix[y+1][x]
            else:
                lowerPixel = False

            # map to unicode block elements
            if upperPixel and lowerPixel:
                char = "█"  # both black
            elif upperPixel and not lowerPixel:
                char = "▀"  # upper black, lower white
            elif not upperPixel and lowerPixel:
                char = "▄"  # upper white, lower black
            else:
                char = " "  # both white

            row_chars.append(char)
        columns.append("".join(row_chars))

    return "\n".join(columns)

