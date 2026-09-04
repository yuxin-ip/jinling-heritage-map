import { pendingConfirmations, type HeritageSite } from './heritage-data';

export type Answers = Record<string, string>;

export function isConfirmed(id: string, answer?: string): boolean {
  const item = pendingConfirmations.find((entry) => entry.id === id);
  return Boolean(
    answer &&
    item?.options.includes(answer) &&
    !['暂不确定', '其他子项'].includes(answer),
  );
}

export function parseAnswers(value: unknown): Answers {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    pendingConfirmations.flatMap((item) => {
      const answer = (value as Record<string, unknown>)[item.id];
      return typeof answer === 'string' && item.options.includes(answer)
        ? [[item.id, answer]]
        : [];
    }),
  );
}

export function resolveConfirmations(
  site: HeritageSite,
  answers: Answers,
): HeritageSite {
  if (!site.subItems) return site;
  const confirmed = new Set<string>();
  const wuAnswered = isConfirmed('wu-tombs', answers['wu-tombs']);
  if (site.id === 'mingxiaoling' && wuAnswered) {
    if (answers['wu-tombs'] === '两处都去了') {
      confirmed.add('吴良墓');
      confirmed.add('吴桢墓');
    } else confirmed.add(answers['wu-tombs']);
  }
  if (
    site.id === 'southern-dynasty-stone' &&
    isConfirmed('jiangning-stone-2', answers['jiangning-stone-2'])
  ) {
    confirmed.add(answers['jiangning-stone-2']);
  }
  return {
    ...site,
    subItems: site.subItems.map((item) => ({
      ...item,
      visited: item.visited || confirmed.has(item.name),
      uncertain:
        item.uncertain &&
        !confirmed.has(item.name) &&
        !(site.id === 'mingxiaoling' && wuAnswered),
    })),
  };
}
