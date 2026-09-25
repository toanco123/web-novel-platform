import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from './api'

export const genreKeys = {
  all: ['genres'] as const,
}

export const useGenres = () => useQuery({ queryKey: genreKeys.all, queryFn: api.getGenres })

export function useCreateGenre() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.createGenre,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: genreKeys.all }),
  })
}
