from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size, filename):
    # Create a new image with a blue background
    img = Image.new('RGBA', (size, size), (13, 110, 253, 255))
    draw = ImageDraw.Draw(img)
    
    # Draw a clipboard icon (simplified)
    margin = size // 4
    
    # Draw clipboard body
    draw.rectangle([margin, margin, size - margin, size - margin], fill=(255, 255, 255, 255))
    
    # Draw clipboard top
    clip_width = size // 3
    clip_x = (size - clip_width) // 2
    draw.rectangle([clip_x, margin - size // 8, clip_x + clip_width, margin + size // 8], fill=(255, 255, 255, 255))
    
    # Draw lines on clipboard
    line_margin = size // 6
    line_spacing = size // 10
    for i in range(3):
        y = margin + line_margin + i * line_spacing
        draw.line([margin + line_margin, y, size - margin - line_margin, y], fill=(13, 110, 253, 255), width=max(1, size // 32))
    
    img.save(filename)

# Create icons
create_icon(16, 'icons/icon16.png')
create_icon(48, 'icons/icon48.png')
create_icon(128, 'icons/icon128.png')

print("Icons created successfully!")
