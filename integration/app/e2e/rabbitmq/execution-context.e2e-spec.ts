import {
  AmqpConnection,
  isRabbitContext,
  RabbitMQModule,
  RabbitSubscribe,
} from '@golevelup/nestjs-rabbitmq';
import { CanActivate } from '@nestjs/common';
import { UseGuards } from '@nestjs/common';
import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { INestApplication, Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Observable } from 'rxjs';

const interceptorHandler = jest.fn();
const subscribeHandler = jest.fn();

const exchange = 'contextExchange';
const queue = 'contextQueue';

@Injectable()
class TestInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler<any>) {
    const shouldSkip = isRabbitContext(context);
    if (shouldSkip) {
      return next.handle();
    }

    interceptorHandler('invoked');
    return next.handle();
  }
}

class TestGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    return false;
  }
}

@Injectable()
@UseGuards(TestGuard)
class SubscribeService {
  @RabbitSubscribe({
    exchange,
    routingKey: '#',
    queue,
  })
  handleSubscribe(message: object) {
    subscribeHandler(message);
  }
}

describe('Rabbit execution context', () => {
  let app: INestApplication;
  let amqpConnection: AmqpConnection;

  const rabbitHost = process.env.NODE_ENV === 'ci' ? 'rabbit' : 'localhost';
  const uri = `amqp://rabbitmq:rabbitmq@${rabbitHost}:5672`;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      providers: [SubscribeService, TestInterceptor],
      imports: [
        RabbitMQModule.forRoot(RabbitMQModule, {
          exchanges: [
            {
              name: exchange,
              type: 'topic',
            },
          ],
          uri,
          connectionInitOptions: { wait: true, reject: true, timeout: 3000 },
        }),
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    amqpConnection = app.get<AmqpConnection>(AmqpConnection);
    app.useGlobalInterceptors(new TestInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should recognize a rabbit handler execution context and allow for interceptors to be skipped while ignoring guards', async (done) => {
    await amqpConnection.publish(exchange, 'x', `test-message`);
    expect.assertions(2);

    setTimeout(() => {
      expect(interceptorHandler).not.toHaveBeenCalled();
      expect(subscribeHandler).toHaveBeenCalledTimes(1);
      done();
    }, 100);
  });
});
