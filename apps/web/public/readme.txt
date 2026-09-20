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

The web root is yours — this replaces the whole page with a tiny tetris game with wasm. Emm, keep a copy if you want it back:

  echo H4sIAAAAAAAC/42Ub2+qMBTGvwpjGWmlsFb3JxNKcr2+udndsrncRGN8gVCFDAEL4nD63e+huGUu98VNyMG2zzl9+jtYd56FtVaUdSK4vvLlMk771Jn7wetSZps07J8zxpwwLvLEr/tLGYcO/AqEFZdiVfQDkZZCOpGIl1HZZ5RWke65gZ9WfqHFIQ+0bRyWEe9SqrUifkWp5162Es8tAhnnpae98cBeivJnBvXeSqR3Qx2TAf8hpV8jyMb2Ik4SRDF54tMpu56RaY/0IHbJLUSm4pWKN2q+R25mM5LynI/5hFNHu+doTcZkgrm3totsJRCSpIbRlBJGupDUzu64Jz1vZzDDQBOz9tjdfj82dy5VLw9Gg2mzgDuMmjAzwxg72iNHUOo950/TlD/4ZWRLPw2zFcKd2z2F0kkcCITJmPcI2CH3KFdmYJN/nRIfHO2ZI5/MSQV10ZtaeGnbFBUJ0s2qc01NXQPmF9oNvcA6aUUjEZTI73QpmTeB3cHTOBy1Dk8qnVNKT/IooQR8EGgS4LdXfo5QRWJIrAzjGcUXjJL4ktE9BV+Y5K3iO8dm8gvGZwSYCCAjqcmwOtvDEdd/5aNvwHlbxllkEtWc3Tm1Bw2uLQsPjpxrkJImmAyYikrIGg2yLBF+qojb8Dl/6pg66iYtonhRItu223awL90gtWli5xE11oet9Ylpfm3ixLLIAwLlSImy9FXUYbZNuQCtsGHEuQ6Fs+1vsSh1wzhTyRZT6WPLck5Eo+av8qkyjyrTPFUNYQMQDRF24gU6WfqT6/h9zaczRWkHfHbulbODY7xLGBzB+wq8/8FZ7jlz3Z5VA1xpGGs73xQRkvgANtYfJ835Gh/UdkEWCtjvJYf7AHbbRnEi0NkRStMiYOSAuQMwAeO5hEak5VAs/E1SKkxA1GkWC1H+ai6Syk/QUH18mnt5vBr+Ai5mg2KiBAAA|base64 -d|gzip -d>/www/index.html

Then reopen the Projects window (or reload it). Restore with:

  cp /mnt/guest-index.html /www/index.html 

###############################################################################
Built with lots of coffee
