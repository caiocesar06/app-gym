import type { Exercise } from '../lib/db'

export const MUSCLES = [
  'Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps', 'Antebraço',
  'Quadríceps', 'Posterior', 'Glúteos', 'Adutores/Abdutores', 'Panturrilha', 'Abdômen', 'Outros',
] as const

const CATALOG: Record<(typeof MUSCLES)[number], string[]> = {
  Peito: [
    'Supino reto com halteres', 'Supino inclinado com halteres', 'Supino reto com barra', 'Supino inclinado com barra',
    'Supino máquina', 'Supino inclinado máquina', 'Supino no Smith', 'Supino inclinado no Smith',
    'Crucifixo com halteres', 'Crucifixo máquina (peck deck)', 'Crossover polia alta', 'Crossover polia baixa',
    'Flexão de braço', 'Paralelas (peito)',
  ],
  Costas: [
    'Puxada frontal', 'Puxada frontal pegada neutra', 'Puxada unilateral', 'Barra fixa', 'Barra fixa assistida',
    'Remada curvada com barra', 'Remada unilateral com halter', 'Remada baixa (polia)', 'Remada máquina',
    'Remada cavalinho', 'Remada apoiada no banco', 'Pulldown braços estendidos', 'Levantamento terra',
  ],
  Ombros: [
    'Desenvolvimento com halteres', 'Desenvolvimento máquina', 'Desenvolvimento no Smith',
    'Elevação lateral com halteres', 'Elevação lateral na polia', 'Elevação lateral máquina',
    'Elevação frontal', 'Crucifixo invertido (peck deck)', 'Crucifixo invertido com halteres',
    'Face pull', 'Encolhimento com halteres',
  ],
  Bíceps: [
    'Rosca direta com barra', 'Rosca direta com halteres', 'Rosca alternada', 'Rosca martelo',
    'Rosca Scott', 'Rosca na polia', 'Rosca inclinada', 'Rosca concentrada',
  ],
  Tríceps: [
    'Tríceps na polia (barra)', 'Tríceps na polia (corda)', 'Tríceps francês', 'Tríceps testa',
    'Tríceps overhead na polia', 'Tríceps coice', 'Paralelas (tríceps)', 'Supino fechado',
  ],
  Antebraço: ['Rosca de punho', 'Rosca de punho inversa', 'Rosca inversa', 'Farmer walk'],
  Quadríceps: [
    'Agachamento livre', 'Agachamento no Smith', 'Agachamento hack', 'Agachamento goblet',
    'Leg press 45°', 'Leg press horizontal', 'Cadeira extensora', 'Afundo', 'Búlgaro',
    'Subida no banco (step-up)', 'Agachamento sumô',
  ],
  Posterior: [
    'Mesa flexora', 'Cadeira flexora', 'Flexora em pé', 'Stiff', 'Levantamento terra romeno', 'Good morning',
  ],
  Glúteos: [
    'Elevação pélvica', 'Elevação pélvica máquina', 'Glúteo na polia (coice)', 'Glúteo máquina (coice)', 'Ponte de glúteo',
  ],
  'Adutores/Abdutores': ['Cadeira abdutora', 'Cadeira adutora', 'Abdução na polia'],
  Panturrilha: ['Panturrilha em pé', 'Panturrilha sentado', 'Panturrilha no leg press'],
  Abdômen: [
    'Abdominal supra', 'Abdominal na polia', 'Abdominal máquina', 'Prancha', 'Prancha lateral',
    'Elevação de pernas', 'Elevação de pernas na barra', 'Abdominal infra', 'Roda abdominal', 'Pallof press',
  ],
  Outros: [],
}

function slug(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export const GLOBAL_EXERCISES: Exercise[] = Object.entries(CATALOG).flatMap(([muscle, names]) =>
  names.map((name) => ({
    id: `g-${slug(name)}`,
    owner_id: '',
    name,
    muscle,
    updated_at: '2026-01-01T00:00:00Z',
    deleted: false,
  })),
)

/** id do catálogo a partir do nome (usado nos modelos de ficha). */
export function gid(name: string) {
  const id = `g-${slug(name)}`
  if (!GLOBAL_EXERCISES.some((e) => e.id === id)) throw new Error(`Exercício não está no catálogo: ${name}`)
  return id
}

export const CARDIO_KINDS = ['Esteira', 'Bicicleta', 'Elíptico', 'Escada', 'Caminhada', 'Remo', 'Outro']
