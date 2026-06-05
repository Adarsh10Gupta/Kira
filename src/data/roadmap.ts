export interface RoadmapTopic {
  id: string;
  title: string;
}

export interface RoadmapPhase {
  id: string;
  title: string;
  weeks: string;
  topics: RoadmapTopic[];
  resources: string[];
  estimatedHours: number;
}

export const roadmapPhases: RoadmapPhase[] = [
  {
    id: 'phase-1',
    title: 'Python & Math Foundations',
    weeks: 'Weeks 1–4',
    estimatedHours: 60,
    topics: [
      { id: 'p1-python-basics', title: 'Python basics' },
      { id: 'p1-numpy', title: 'NumPy' },
      { id: 'p1-pandas', title: 'Pandas' },
      { id: 'p1-matplotlib', title: 'Matplotlib' },
      { id: 'p1-linear-algebra', title: 'Linear algebra intuition' },
      { id: 'p1-statistics', title: 'Basic statistics' },
    ],
    resources: [
      'freeCodeCamp Python',
      'CS50P (Harvard)',
      'Khan Academy Linear Algebra',
    ],
  },
  {
    id: 'phase-2',
    title: 'Machine Learning Basics',
    weeks: 'Weeks 5–10',
    estimatedHours: 90,
    topics: [
      { id: 'p2-what-is-ml', title: 'What is ML' },
      { id: 'p2-supervised', title: 'Supervised learning' },
      { id: 'p2-regression', title: 'Linear/logistic regression' },
      { id: 'p2-decision-trees', title: 'Decision trees' },
      { id: 'p2-sklearn', title: 'Scikit-learn' },
      { id: 'p2-first-model', title: 'Your first trained model' },
      { id: 'p2-overfitting', title: 'Overfitting/underfitting' },
      { id: 'p2-cross-validation', title: 'Cross-validation' },
    ],
    resources: [
      'Andrew Ng ML Specialization (Coursera)',
      'Kaggle micro-courses',
    ],
  },
  {
    id: 'phase-3',
    title: 'Deep Learning',
    weeks: 'Weeks 11–18',
    estimatedHours: 120,
    topics: [
      { id: 'p3-nn-intuition', title: 'Neural network intuition' },
      { id: 'p3-backprop', title: 'Backpropagation' },
      { id: 'p3-pytorch', title: 'PyTorch basics' },
      { id: 'p3-cnns', title: 'CNNs for image recognition' },
      { id: 'p3-training-loops', title: 'Training loops' },
      { id: 'p3-transfer-learning', title: 'Transfer learning' },
      { id: 'p3-first-dl-project', title: 'Your first DL project' },
    ],
    resources: [
      'fast.ai Practical Deep Learning',
      'PyTorch official tutorials',
    ],
  },
  {
    id: 'phase-4',
    title: 'AI & LLMs',
    weeks: 'Weeks 19–26',
    estimatedHours: 120,
    topics: [
      { id: 'p4-transformers', title: 'Transformer architecture' },
      { id: 'p4-attention', title: 'Attention mechanism' },
      { id: 'p4-huggingface', title: 'Hugging Face basics' },
      { id: 'p4-prompt-eng', title: 'Prompt engineering' },
      { id: 'p4-api', title: 'Claude/OpenAI API' },
      { id: 'p4-finetuning', title: 'Fine-tuning basics' },
      { id: 'p4-rag', title: 'RAG (Retrieval Augmented Generation)' },
      { id: 'p4-ai-app', title: 'Build an AI-powered app' },
    ],
    resources: [
      'Hugging Face NLP Course',
      "Andrej Karpathy's Neural Networks Zero to Hero",
    ],
  },
  {
    id: 'phase-5',
    title: 'Build & Ship',
    weeks: 'Ongoing',
    estimatedHours: 200,
    topics: [
      { id: 'p5-portfolio', title: 'Portfolio project' },
      { id: 'p5-open-source', title: 'Contribute to open source' },
      { id: 'p5-internships', title: 'Apply to ML internships' },
      { id: 'p5-freelance', title: 'Freelance AI projects' },
      { id: 'p5-life-os', title: 'Build on top of your Life OS app' },
    ],
    resources: [],
  },
];

export function getAllTopicIds(): string[] {
  return roadmapPhases.flatMap((p) => p.topics.map((t) => t.id));
}

export function getTotalTopics(): number {
  return roadmapPhases.reduce((sum, p) => sum + p.topics.length, 0);
}
