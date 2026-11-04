"""Build screenshots/trash-contact-v2.png: v2 top-down sprites on sea-blue and light grey
(normalised cells), plus a strip with the in-game relative sizes (look) and a halo zoom."""
from PIL import Image, ImageDraw
import json
m=json.load(open('asset-sources/trash/sprites.json'))
cols=6; cell=200; rows=(len(m)+cols-1)//cols
W=cols*cell; half=rows*(cell+24); strip=3*165+30; H=half*2+strip+256
im=Image.new('RGB',(W,H),(20,88,120)); d=ImageDraw.Draw(im)
for k,bgc in enumerate([(20,88,120),(235,235,235)]):
  d.rectangle([0,k*half,W,(k+1)*half],fill=bgc)
  for i,e in enumerate(m):
    x=(i%cols)*cell; y=k*half+(i//cols)*(cell+24)
    s=Image.open(e['file']).resize((180,180),Image.LANCZOS)
    im.paste(s,(x+10,y+4),s); d.text((x+8,y+cell+4),e['file'].split('/')[-1][:-4],fill=(255,255,255) if k==0 else (0,0,0))
# relative Spielgröße: lange Seite = look * 120 px
y0=half*2; d.rectangle([0,y0,W,y0+strip],fill=(14,120,160)); d.text((8,y0+4),'relative Groessen (look)',fill=(255,255,255))
x=10; y=y0+20
for e in sorted(m,key=lambda e:-e['look']):
  n=round(e['look']*120); s=Image.open(e['file']).resize((n,n),Image.LANCZOS)
  if x+n>W: x=10; y+=165
  im.paste(s,(x,y+(150-n)//2),s); x+=n+4
yz=y0+strip
for i,f in enumerate(['plastik-sixpack-ring','gummi-reifen','glas-flasche','sonstiges-fischernetz']):
  s=Image.open(f'assets/trash/{f}.png'); im.paste(s,(i*256 if i<4 else 0,yz),s)
im.save('screenshots/trash-contact-v2.png')
print('screenshots/trash-contact-v2.png',im.size)
