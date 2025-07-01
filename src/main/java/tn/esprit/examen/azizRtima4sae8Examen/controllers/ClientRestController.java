package tn.esprit.examen.azizRtima4sae8Examen.controllers;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import tn.esprit.examen.azizRtima4sae8Examen.entities.Client;
import tn.esprit.examen.azizRtima4sae8Examen.services.IServices;

import java.util.List;

@RequiredArgsConstructor
@RequestMapping("examen")
@RestController
public class ClientRestController {
    private final IServices services;

    @PostMapping("/add")
    public Client add(@RequestBody Client client){
        return  services.add(client);
    }

}
