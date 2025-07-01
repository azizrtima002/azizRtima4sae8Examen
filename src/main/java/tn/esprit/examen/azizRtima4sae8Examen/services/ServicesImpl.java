package tn.esprit.examen.azizRtima4sae8Examen.services;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import tn.esprit.examen.azizRtima4sae8Examen.entities.*;
import tn.esprit.examen.azizRtima4sae8Examen.entities.Client;
import tn.esprit.examen.azizRtima4sae8Examen.repositories.IClientRepository;

import java.time.LocalDate;
import java.util.List;

@Slf4j
@RequiredArgsConstructor
@Service
public class ServicesImpl implements IServices {

    private final IClientRepository clientRepository;



    @Override
    public Client add(Client client) {
        return clientRepository.save(client);
    }

    @Scheduled(cron = "*/15 * * * * *")
    @Override
    public void test() {
        log.info("testing");
    }
}
