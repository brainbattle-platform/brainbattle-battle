import { Injectable } from '@nestjs/common';
import { Prisma, BattleType, Level } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';


@Injectable()
export class QuestionBankService {
  constructor(private readonly prisma: PrismaService) {}

  async seedIfEmpty() {
    const count = await this.prisma.questionBankQuestion.count();
    if (count > 0) return;

    // Seed 30 questions per type/level minimal (demo)
    const types = [BattleType.LISTENING, BattleType.READING, BattleType.WRITING];
    const levels = [Level.BASIC, Level.MEDIUM, Level.HIGH];

    const items: any[] = [];
    for (const t of types) {
      for (const l of levels) {
        for (let i = 1; i <= 10; i++) {
          items.push({
            bankType: t,
            level: l,
            prompt: `[${t}/${l}] Q${i}: Choose correct option`,
            options: ['A', 'B', 'C', 'D'],
            correctKey: ['A','B','C','D'][i % 4],
            assetUrl: t === BattleType.LISTENING ? 'https://example.com/audio.mp3' : null,
          });
        }
      }
    }
    await this.prisma.questionBankQuestion.createMany({ data: items });
  }

  async pickRandom(bankType: BattleType, level: Level, count: number) {
    // naive random: take latest N then shuffle in memory
    const rows = await this.prisma.questionBankQuestion.findMany({
      where: { bankType, level },
      take: Math.max(count, 50),
      orderBy: { createdAt: 'desc' },
    });
    // shuffle
    for (let i = rows.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rows[i], rows[j]] = [rows[j], rows[i]];
    }
    return rows.slice(0, count);
  }
}
