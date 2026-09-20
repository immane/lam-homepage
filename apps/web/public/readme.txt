### Lam K. / lam.wiki ##########################################################

Independent Engineer building AI systems, distributed platforms and embedded
software — somewhere between intelligent and silicon-level computing.

This box is a real i686 Linux running inside your browser (v86), and it is
serving the "Projects" app you may already have open: a small Finder-style
browser over github.com/immane, fetched live through a bridge to the page
that owns this VM.

  homepage   https://github.com/immane
  mail       me@lam.wiki
  stack      TypeScript, React, Rust, PHP, Python, Verilog, FPGA

Everything served to browsers lives in /www. Have a look around:

  ls /www
  cat /www/index.html

The web root is yours — this replaces the whole page with a tiny animated
matrix, so keep a copy if you want it back:

  printf "<!doctype html><html lang='en'><body style='margin:0;background:#000;overflow:hidden'><canvas id='c'></canvas><script>c.width=innerWidth;c.height=innerHeight;let x=c.getContext('2d'),s=16,n=c.width/s,d=Array(n|0).fill(1);setInterval(()=>{x.fillStyle='#0001';x.fillRect(0,0,c.width,c.height);x.fillStyle='#0f0';x.font=s+'px monospace';d.forEach((y,i)=>{x.fillText(String.fromCharCode(0x30A0+Math.random()*96),i*s,y*s);if(y*s>c.height&&Math.random()>.975)d[i]=0;d[i]++})},33)</script></html>" > /www/index.html

Then reopen the Projects window (or reload it). Restore with:

  cp /mnt/guest-index.html /www/index.html 

###############################################################################
Built with lots of coffee
