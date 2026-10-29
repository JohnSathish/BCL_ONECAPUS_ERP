import http from 'http';
import express from 'express';
import multer from 'multer';
import { AddressInfo } from 'net';
import {
  boundaryFrom,
  repairMislabeledMultipart,
} from './repair-mislabeled-multipart';

function multipartBody() {
  const jpeg = Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
    Buffer.alloc(800, 0xab),
  ]);
  const boundary = 'WebKitFormBoundaryPhotoBulk';
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="identifierStrategy"\r\n\r\nrollNumber\r\n` +
        `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="BA26-001.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`,
    ),
    jpeg,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return { body, boundary };
}

function listen(app: express.Express) {
  return new Promise<{ server: http.Server; port: number }>((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const port = (server.address() as AddressInfo).port;
      resolve({ server, port });
    });
  });
}

function post(
  port: number,
  path: string,
  contentType: string,
  body: Buffer | string,
) {
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(body);
  return new Promise<{ status: number; json: any }>((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path,
        method: 'POST',
        headers: {
          'content-type': contentType,
          'content-length': payload.length,
          connection: 'close',
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          resolve({
            status: res.statusCode ?? 0,
            json: text ? JSON.parse(text) : null,
          });
        });
      },
    );
    req.on('error', reject);
    req.end(payload);
  });
}

describe('repairMislabeledMultipart', () => {
  it('reads a multipart boundary from the body prefix', () => {
    const head = Buffer.from(
      '--WebKitFormBoundaryPhotoBulk\r\nContent-Disposition: form-data; name="files"\r\n',
    );
    expect(boundaryFrom(head)).toBe('WebKitFormBoundaryPhotoBulk');
    expect(
      boundaryFrom(Buffer.from('{"identifierStrategy":"rollNumber"}')),
    ).toBeNull();
  });

  it('lets Multer read a photo upload that Axios labeled as urlencoded', async () => {
    const upload = multer({ storage: multer.memoryStorage() }).array(
      'files',
      5,
    );
    const app = express();
    app.use(repairMislabeledMultipart);
    app.use(express.json({ limit: '5mb' }));
    app.use(express.urlencoded({ extended: true, limit: '5mb' }));
    app.post('/api/v1/students/photos/bulk/preview', (req, res) => {
      upload(req, res, (err) => {
        if (err) {
          res.status(400).json({ error: err.message });
          return;
        }
        const files = (req.files ?? []) as Express.Multer.File[];
        res.json({
          contentType: req.headers['content-type'],
          strategy: req.body.identifierStrategy,
          files: files.map((file) => ({
            name: file.originalname,
            size: file.size,
          })),
        });
      });
    });

    const { server, port } = await listen(app);
    try {
      const { body } = multipartBody();
      const result = await post(
        port,
        '/api/v1/students/photos/bulk/preview',
        'application/x-www-form-urlencoded',
        body,
      );
      expect(result.status).toBe(200);
      expect(result.json.strategy).toBe('rollNumber');
      expect(result.json.contentType).toContain('multipart/form-data');
      expect(result.json.contentType).toContain('WebKitFormBoundaryPhotoBulk');
      expect(result.json.files).toEqual([{ name: 'BA26-001.jpg', size: 804 }]);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
    }
  });

  it('parses a tiny mislabeled upload after the request has already ended', async () => {
    const upload = multer({ storage: multer.memoryStorage() }).array(
      'files',
      5,
    );
    const app = express();
    app.use(repairMislabeledMultipart);
    app.use(express.json({ limit: '5mb' }));
    app.use(express.urlencoded({ extended: true, limit: '5mb' }));
    app.post('/api/v1/students/photos/bulk/preview', (req, res) => {
      upload(req, res, (err) => {
        if (err) {
          res.status(400).json({ error: err.message });
          return;
        }
        const files = (req.files ?? []) as Express.Multer.File[];
        res.json({
          strategy: req.body.identifierStrategy,
          files: files.map((file) => ({
            name: file.originalname,
            size: file.size,
          })),
        });
      });
    });
    const boundary = 'TinyB';
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="identifierStrategy"\r\n\r\nrollNumber\r\n` +
          `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="a.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`,
      ),
      jpeg,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    expect(body.length).toBeLessThan(240);
    const { server, port } = await listen(app);
    try {
      const result = await post(
        port,
        '/api/v1/students/photos/bulk/preview',
        'application/x-www-form-urlencoded',
        body,
      );
      expect(result.status).toBe(200);
      expect(result.json).toEqual({
        strategy: 'rollNumber',
        files: [{ name: 'a.jpg', size: 4 }],
      });
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
    }
  });

  it('still parses a normal JSON body on the same route', async () => {
    const app = express();
    app.use(repairMislabeledMultipart);
    app.use(express.json({ limit: '5mb' }));
    app.post('/api/v1/students/photos/bulk/preview', (req, res) => {
      res.json({ strategy: req.body.identifierStrategy });
    });
    const { server, port } = await listen(app);
    try {
      const result = await post(
        port,
        '/api/v1/students/photos/bulk/preview',
        'application/json',
        JSON.stringify({ identifierStrategy: 'rollNumber' }),
      );
      expect(result.status).toBe(200);
      expect(result.json.strategy).toBe('rollNumber');
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
    }
  });
});
