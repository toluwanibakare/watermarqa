# Watermarqa

Watermarqa is a client-side batch watermarking web application designed for media teams. It runs entirely in the browser using HTML5 Canvas, ensuring privacy, speed, and cross-platform compatibility (including mobile/Safari on iPhone).

## Key Features

- **IndexedDB Persistence**: Upload your church or organization logo once. The browser saves it locally so it is ready next time you open the app.
- **Smart Auto-Positioning**: Automatically centers watermarks horizontally at the bottom of the photo.
- **Proportional Scaling**: Watermarks automatically adjust their size relative to each photo's resolution (e.g., matching a consistent width percentage), preventing them from appearing oversized on smaller pictures.
- **Batch Export**: Download individual watermarked images or compile all of them into a ZIP archive in one click.
- **Privacy First**: No server, no databases, no APIs. Images are processed locally on your machine.

## Getting Started

Because Watermarqa is written entirely in static HTML, CSS, and Vanilla JavaScript, there are no build steps or server requirements.

### Running Locally

1. Clone or download the repository.
2. Double-click `index.html` to open the app directly in any modern web browser.

### Deploying to Vercel

You can deploy Watermarqa to Vercel in seconds:

1. Install the Vercel CLI:
   ```bash
   npm i -g vercel
   ```
2. Run the deployment command in the project directory:
   ```bash
   vercel
   ```
3. Alternatively, push this folder to GitHub and link it to your Vercel Dashboard for automated continuous deployment.

## License

This project is open-source and licensed under the [MIT License](LICENSE).

---

&copy; 2026. Built by [TMB](https://www.tmb.it.com).
"# watermaqa" 
