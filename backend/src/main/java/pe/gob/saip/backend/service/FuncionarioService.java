package pe.gob.saip.backend.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.gob.saip.backend.model.entity.Funcionario;
import pe.gob.saip.backend.repository.FuncionarioRepository;

import java.util.List;
import java.util.Optional;

@Service
public class FuncionarioService {

    private final FuncionarioRepository funcionarioRepository;

    public FuncionarioService(FuncionarioRepository funcionarioRepository) {
        this.funcionarioRepository = funcionarioRepository;
    }

    @Transactional(readOnly = true)
    public List<Funcionario> obtenerTodosLosFuncionarios() {
        return funcionarioRepository.findAll();
    }

    @Transactional(readOnly = true)
    public Optional<Funcionario> obtenerFuncionarioPorId(Long id) {
        return funcionarioRepository.findById(id);
    }

    @Transactional(readOnly = true)
    public Optional<Funcionario> obtenerFuncionarioPorEmail(String email) {
        return funcionarioRepository.findByEmail(email);
    }

    @Transactional(readOnly = true)
    public List<Funcionario> obtenerFuncionariosPorEntidad(Long entidadId) {
        return funcionarioRepository.findByEntidad_IdEntidad(entidadId);
    }

    @Transactional
    public Funcionario guardarFuncionario(Funcionario funcionario) {
        return funcionarioRepository.save(funcionario);
    }

    @Transactional
    public void eliminarFuncionario(Long id) {
        funcionarioRepository.deleteById(id);
    }
}
