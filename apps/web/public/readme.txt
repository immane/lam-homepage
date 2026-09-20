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

The web root is yours — this replaces the whole page with a tiny tetris game, so keep a copy if you want it back:

  echo H4sIAAAAAAAC/41Ua2+iQBT9K5ZuyYxc6Yz2kYpDsrt+2XTb9JFNNMakI4xCioADorT63/cCdvv4tAm5MJdz7r1z5sDAk3Ehs1boC6+1Cf08EF3GWoEKF0EuzhhzB5mnwzR3t8KzFyr/mcS52ubE6PoGhZn4rrUsCXKoPQ+jiDAKd2Iy4edTmPSgh7ELlxh5Hc/qeFHne3AxnUIqRmIsYsHgWpAVjGBMhbuys2SpCNFQ4mrCgEMXOU32RbjadV9MbppkbJUuv9rtRtbLgNU3F1ezSfWCtjmzMDOllMKtIFjpNRV3k1jcyDywtYz9ZElo+3LHsHIUeopQGIkejAXbw70gEnwokEW29dYe8zJS4inIIvLttWifs32LM3bSumAn9AkazIPyciLbXQZ+FfgVXtj9oen+sY5xzBgzPtIYMEAdAUVHYe2lTAkpIERiYZr3JDzhDMJTznYMp6KQNoivElXJDwrdE1QAUA2ILY5C7OHmoMR/0ckXKUVTxZknmpSCXzmlK5hTdjp0dpCwRChUweJoCVUoXZIfSRIpGdOqnp2l7zhe73QdZ0E4z4lt242b+LuZKJSWRZ1bgpMPm8nHlgXXJK2tUlmg04EbUolcYZL4WZV+somFQqiycSWEgWWTzW81zw3TPKq5HV6zR0j+BHqofP8PZR1Q2PETaogNEDREw3zK/0kxS1Zigvb+KumrRo8fVJe16vJNZL0TfDDodUrchTbNlZ2us4BouqeAc6zedpqKFa0aeomvsONjKj1V9VOFjIixCcJIkaODMtUxoVD4iQ4P2iAx1XgecT5Uc7mO8kouP/HWS0zZs8Qv7axx5lLqRRj3mTOT3vNCJ+vY7x9zzh0/xMOTZX+hQ9/BJ091wlwts76HJZR2mr9GH7+KIjAAz6zum6n8V/W6mnIIZ+eMDk4P/5S/jk64LX4EAAA=|base64 -d|gzip -d >/www/index.html

Then reopen the Projects window (or reload it). Restore with:

  cp /mnt/guest-index.html /www/index.html 

###############################################################################
Built with lots of coffee
