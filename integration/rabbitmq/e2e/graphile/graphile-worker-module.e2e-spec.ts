import {
  GraphileWorkerModule,
  GRAPHILE_WORKER_UTILS_TOKEN,
  GraphileWorkerHandler,
} from '@golevelup/nestjs-graphile-worker';
import { INestApplication } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { WorkerUtils } from 'graphile-worker';

const QUEUE_NAME = 'handleWork';
const handler = jest.fn();

@Injectable()
class WorkerService {
  @GraphileWorkerHandler({
    name: QUEUE_NAME,
  })
  public handleWork(args: {}) {
    handler(args);
  }
}

describe('graphile workers', () => {
  let app: INestApplication;
  let workerUtils: WorkerUtils;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [
        GraphileWorkerModule.forRoot(GraphileWorkerModule, {
          connectionString: 'postgresql://postgres:password@localhost:33432',
        }),
      ],
      providers: [WorkerService],
    }).compile();

    app = moduleFixture.createNestApplication();
    workerUtils = app.get<WorkerUtils>(GRAPHILE_WORKER_UTILS_TOKEN);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('processes queued jobs', async (done) => {
    expect.assertions(3);
    expect(workerUtils).toBeDefined();

    const message = { message: 'hello' };
    const job = await workerUtils.addJob(QUEUE_NAME, message);

    setTimeout(() => {
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(message);
      done();
    }, 100);
  });
});
