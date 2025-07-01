package tn.esprit.examen.azizRtima4sae8Examen.repositories;

import org.springframework.data.jpa.repository.JpaRepository;
import tn.esprit.examen.azizRtima4sae8Examen.entities.Client;

public interface IClientRepository extends JpaRepository<Client, Long> {
}