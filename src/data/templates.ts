import type { Day, Slot } from '../lib/db'
import { uid } from '../lib/repo'
import { gid } from './exercises'

export const REST_HEAVY = 120
export const REST_NORMAL = 90

function s(label: string, options: string[], sets = 3, reps = '8-12', heavy = false): Slot {
  return { id: uid(), label, options: options.map(gid), heavy, rest: heavy ? REST_HEAVY : REST_NORMAL, sets, reps }
}
const H = (label: string, options: string[], sets = 3, reps = '6-10') => s(label, options, sets, reps, true)

function day(name: string, slots: Slot[], rotation = true): Day {
  return { id: uid(), name, rotation, slots }
}

export type Template = { id: string; name: string; description: string; build: () => Day[] }

export const TEMPLATES: Template[] = [
  {
    id: 'upper-lower',
    name: 'Upper / Lower (4 dias)',
    description: 'Rotação Upper A → Lower A → Upper B → Lower B, com Full Body para semanas curtas e um dia Extra.',
    build: () => [
      day('Upper A', [
        H('Supino', ['Supino reto com halteres', 'Supino máquina', 'Supino no Smith']),
        H('Remada', ['Remada curvada com barra', 'Remada cavalinho', 'Remada máquina']),
        s('Peito inclinado', ['Supino inclinado com halteres', 'Supino inclinado máquina']),
        s('Puxada', ['Puxada frontal', 'Puxada frontal pegada neutra', 'Barra fixa']),
        s('Elevação lateral', ['Elevação lateral com halteres', 'Elevação lateral na polia'], 3, '12-15'),
        s('Bíceps', ['Rosca direta com halteres', 'Rosca Scott']),
        s('Tríceps', ['Tríceps na polia (corda)', 'Tríceps na polia (barra)']),
      ]),
      day('Lower A', [
        H('Agachamento', ['Agachamento hack', 'Agachamento no Smith', 'Agachamento livre']),
        H('Stiff', ['Stiff', 'Levantamento terra romeno']),
        s('Extensora', ['Cadeira extensora'], 3, '10-15'),
        s('Flexora', ['Mesa flexora', 'Cadeira flexora'], 3, '10-15'),
        s('Panturrilha', ['Panturrilha em pé', 'Panturrilha sentado'], 4, '10-15'),
        s('Abdômen', ['Abdominal na polia', 'Elevação de pernas'], 3, '12-15'),
      ]),
      day('Upper B', [
        H('Desenvolvimento', ['Desenvolvimento com halteres', 'Desenvolvimento máquina']),
        H('Puxada', ['Barra fixa', 'Puxada frontal', 'Barra fixa assistida']),
        s('Supino', ['Supino máquina', 'Supino reto com halteres']),
        s('Remada', ['Remada baixa (polia)', 'Remada unilateral com halter']),
        s('Crucifixo', ['Crucifixo máquina (peck deck)', 'Crossover polia alta'], 3, '12-15'),
        s('Posterior de ombro', ['Crucifixo invertido (peck deck)', 'Face pull'], 3, '12-15'),
        s('Bíceps', ['Rosca martelo', 'Rosca alternada']),
        s('Tríceps', ['Tríceps overhead na polia', 'Tríceps francês']),
      ]),
      day('Lower B', [
        H('Terra / quadril', ['Levantamento terra romeno', 'Elevação pélvica']),
        H('Unilateral', ['Búlgaro', 'Afundo', 'Leg press horizontal']),
        s('Flexora', ['Cadeira flexora', 'Mesa flexora'], 3, '10-15'),
        s('Extensora', ['Cadeira extensora'], 3, '12-15'),
        s('Abdutora', ['Cadeira abdutora'], 3, '12-20'),
        s('Panturrilha', ['Panturrilha sentado', 'Panturrilha em pé'], 4, '10-15'),
      ]),
      day('Full Body A', [
        H('Supino', ['Supino reto com halteres', 'Supino máquina']),
        H('Agachamento', ['Agachamento hack', 'Agachamento no Smith']),
        s('Remada', ['Remada máquina', 'Remada baixa (polia)']),
        s('Flexora', ['Mesa flexora']),
        s('Elevação lateral', ['Elevação lateral com halteres'], 3, '12-15'),
      ], false),
      day('Full Body B', [
        H('Puxada', ['Puxada frontal', 'Barra fixa']),
        H('Stiff', ['Stiff', 'Levantamento terra romeno']),
        s('Desenvolvimento', ['Desenvolvimento máquina', 'Desenvolvimento com halteres']),
        s('Extensora', ['Cadeira extensora']),
        s('Bíceps + tríceps', ['Rosca martelo', 'Tríceps na polia (corda)']),
      ], false),
      day('Extra', [
        s('Ombro', ['Elevação lateral na polia', 'Elevação lateral com halteres'], 4, '12-15'),
        s('Antebraço', ['Rosca de punho', 'Rosca inversa'], 3, '12-15'),
        s('Abdômen', ['Abdominal na polia', 'Prancha', 'Roda abdominal'], 3, '10-15'),
      ], false),
    ],
  },
  {
    id: 'full-body',
    name: 'Full Body A / B',
    description: 'Dois treinos de corpo inteiro alternados, 2 a 3 vezes por semana.',
    build: () => [
      day('Full Body A', [
        H('Agachamento', ['Agachamento goblet', 'Agachamento hack', 'Leg press horizontal']),
        H('Supino', ['Supino reto com halteres', 'Supino máquina']),
        s('Remada', ['Remada baixa (polia)', 'Remada máquina']),
        s('Flexora', ['Mesa flexora', 'Cadeira flexora']),
        s('Elevação lateral', ['Elevação lateral com halteres'], 3, '12-15'),
        s('Abdômen', ['Prancha', 'Abdominal supra'], 3, '30-45s'),
      ]),
      day('Full Body B', [
        H('Quadril', ['Elevação pélvica', 'Levantamento terra romeno']),
        H('Puxada', ['Puxada frontal', 'Barra fixa assistida']),
        s('Desenvolvimento', ['Desenvolvimento com halteres', 'Desenvolvimento máquina']),
        s('Extensora', ['Cadeira extensora']),
        s('Bíceps', ['Rosca alternada', 'Rosca martelo']),
        s('Tríceps', ['Tríceps na polia (corda)']),
      ]),
    ],
  },
  {
    id: 'iniciante',
    name: 'Iniciante — máquinas',
    description: 'Treino A / B só com máquinas e polias: seguro e fácil de aprender. Bom para começar.',
    build: () => [
      day('Treino A', [
        s('Pernas', ['Leg press horizontal', 'Cadeira extensora'], 3, '12-15'),
        s('Peito', ['Supino máquina', 'Crucifixo máquina (peck deck)'], 3, '12-15'),
        s('Costas', ['Puxada frontal', 'Remada máquina'], 3, '12-15'),
        s('Glúteo', ['Elevação pélvica máquina', 'Cadeira abdutora'], 3, '12-15'),
        s('Abdômen', ['Abdominal máquina', 'Prancha'], 3, '12-15'),
      ]),
      day('Treino B', [
        s('Posterior', ['Cadeira flexora', 'Mesa flexora'], 3, '12-15'),
        s('Costas', ['Remada baixa (polia)', 'Remada máquina'], 3, '12-15'),
        s('Ombro', ['Desenvolvimento máquina', 'Elevação lateral máquina'], 3, '12-15'),
        s('Adutores', ['Cadeira adutora', 'Cadeira abdutora'], 3, '12-15'),
        s('Braços', ['Rosca na polia', 'Tríceps na polia (corda)'], 3, '12-15'),
        s('Panturrilha', ['Panturrilha sentado'], 3, '15-20'),
      ]),
    ],
  },
]

export function blankDay(name = 'Novo dia'): Day {
  return day(name, [])
}

export function blankSlot(): Slot {
  return { id: uid(), label: '', options: [], heavy: false, rest: REST_NORMAL, sets: 3, reps: '8-12' }
}
