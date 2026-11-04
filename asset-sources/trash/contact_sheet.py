"""Build screenshots/trash-contact-v3.png: 4 Zeilen = 4 Sortier-Kategorien (Titel links),
je 6 Sprites auf Meerblau in Spielgröße (look) und normiert, plus Halo-Zoom."""
from PIL import Image, ImageDraw, ImageFont
import json
m=json.load(open('asset-sources/trash/sprites.json'))
CATS=[('plastik','Plastik',(255,214,64)),('metall','Metall',(200,210,220)),('glas','Glas',(120,230,170)),('rest','Restmüll',(150,150,150))]
def font(s):
  for f in ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf']:
    try: return ImageFont.truetype(f,s)
    except OSError: pass
  return ImageFont.load_default()
F,f2=font(34),font(15)
cell=190; lab=210; W=lab+6*cell; rowH=cell+30; H=len(CATS)*rowH+40+230
im=Image.new('RGB',(W,H),(20,88,120)); d=ImageDraw.Draw(im)
d.text((12,8),'Ocean Clean – 4 Kategorien (v3, Draufsicht, normiert)',font=f2,fill=(255,255,255))
for r,(c,title,col) in enumerate(CATS):
  y=40+r*rowH; d.rectangle([0,y,W,y+rowH-6],fill=(16,76,106) if r%2 else (22,96,130))
  d.rectangle([0,y,10,y+rowH-6],fill=col); d.text((24,y+cell//2-20),title,font=F,fill=col)
  items=[e for e in m if e['category']==c]
  for i,e in enumerate(items):
    x=lab+i*cell; s=Image.open(e['file']).resize((170,170),Image.LANCZOS); im.paste(s,(x+10,y+4),s)
    d.text((x+10,y+cell-6),e['label'],font=f2,fill=(255,255,255))
# Spielgrößen: je Kategorie in Spalten
y=40+len(CATS)*rowH; d.text((12,y),'Spielgröße (look) je Kategorie',font=f2,fill=(255,255,255))
for r,(c,title,col) in enumerate(CATS):
  x=12+r*(W//4); d.text((x,y+22),title,font=f2,fill=col); xx=x; yy=y+44
  for e in [e for e in m if e['category']==c]:
    n=round(e['look']*80); s=Image.open(e['file']).resize((n,n),Image.LANCZOS)
    if xx+n>x+W//4-8: xx=x; yy+=92
    im.paste(s,(xx,yy+(90-n)//2),s); xx+=n+2
im.save('screenshots/trash-contact-v3.png'); print(im.size)
