declare module 'jordium-gantt-vue3' {
  import { DefineComponent } from 'vue'
  
  export const GanttChart: DefineComponent<any, any, any>
  
  export interface Task {
    id: number
    name: string
    startDate: string
    endDate: string
    progress: number
    predecessor?: number[]
  }
  
  export interface Milestone {
    id: number
    name: string
    date: string
    type: string
  }
}

declare module 'jordium-gantt-vue3/dist/assets/jordium-gantt-vue3.css'
