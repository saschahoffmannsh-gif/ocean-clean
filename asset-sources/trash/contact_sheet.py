"""Build screenshots/trash-contact.png (sprites on sea-blue and light grey)."""
from PIL import Image, ImageDraw
import json
m=json.load(open('asset-sources/trash/sprites.json'))
cols=6; cell=200; rows=(len(m)+cols-1)//cols
W=cols*cell; H=rows*(cell+24)*2
im=Image.new('RGB',(W,H)); d=ImageDraw.Draw(im)
for k,bgc in enumerate([(20,88,120),(235,235,235)]):
  d.rectangle([0,k*H//2,W,(k+1)*H//2],fill=bgc)
  for i,e in enumerate(m):
    x=(i%cols)*cell; y=k*H//2+(i//cols)*(cell+24)
    s=Image.open(e['file']).resize((180,180),Image.LANCZOS)
    im.paste(s,(x+10,y+4),s); d.text((x+8,y+cell+4),e['file'].split('/')[-1][:-4],fill=(255,255,255) if k==0 else (0,0,0))
im.save('screenshots/trash-contact.png')
z=Image.new('RGB',(1024,512),(20,88,120))
for i,f in enumerate(['plastik-sixpack-ring','plastik-strohhalm','glas-flasche','sonstiges-fischernetz']):
  s=Image.open(f'assets/trash/{f}.png'); z.paste(s,(i*256,0),s)
  s2=s.crop((64,64,192,192)).resize((256,256),Image.NEAREST); z.paste(s2,(i*256,256),s2)
z.save('screenshots/trash-halo-zoom.png')
