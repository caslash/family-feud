//
//  StateControlViewModel.swift
//  FamilyFeud-Desktop
//
//  Created by Cameron Slash on 12/4/23.
//

import FeudKit
import Foundation
import Observation

@Observable
class StateControlViewModel {
    private var multiplayerservice: MultiplayerService
    
    private var windowcontroller: ManagementWindowController
    
    private var game: FamilyFeudGame
    
    public var viewstateservice: ViewStateService
    
    init(game: FamilyFeudGame, viewstateservice: ViewStateService, windowcontroller: ManagementWindowController, multiplayerservice: MultiplayerService) {
        self.multiplayerservice = multiplayerservice
        self.game = game
        self.windowcontroller = windowcontroller
        self.viewstateservice = viewstateservice
        self.viewstateservice.newGameEnabled = true
    }
    
    func startGame() async {
        if let match = await self.multiplayerservice.match {
            _ = game.changeState(type: FFStateType.NEW_GAME)
            self.viewstateservice.manageFamiliesEnabled = true
            self.viewstateservice.loadQuestionEnabled = true
            self.viewstateservice.initializeGameEnabled = true
            self.viewstateservice.newGameEnabled = false
            self.viewstateservice.fastMoneyEnabled = false
            self.viewstateservice.addFamilyPanelEnabled = false
            self.viewstateservice.familiesPanelEnabled = false
        } else {
            await self.multiplayerservice.choosePlayer()
        }
    }
    
    func manageFamilies() {
        if (self.game.changeState(type: FFStateType.ADD_FAMILY)) {
            self.viewstateservice.addFamilyPanelEnabled = true
            self.viewstateservice.loadQuestionsPanelEnabled = false
        }
    }
    
    func loadQuestions() {
        _ = game.changeState(type: FFStateType.LOAD_QUESTIONS)
        self.viewstateservice.addFamilyPanelEnabled = false
        self.viewstateservice.loadQuestionsPanelEnabled = true
    }
    
    func initializeGame() {
        if (self.game.changeState(type: FFStateType.INITIALIZE_GAME)) {
            self.viewstateservice.initializeGameEnabled = false
            self.viewstateservice.newGameEnabled = false
            self.viewstateservice.manageFamiliesEnabled = false
            self.viewstateservice.loadQuestionEnabled = false
            self.viewstateservice.addFamilyPanelEnabled = false
            self.viewstateservice.loadQuestionsPanelEnabled = false
            self.viewstateservice.playGameEnabled = true
        }
    }
    
    func playGame() {
        if (game.changeState(type: FFStateType.PLAY)) {
            self.viewstateservice.playGameEnabled = false
            self.viewstateservice.initializeGameEnabled = false
            self.viewstateservice.fastMoneyEnabled = true
            self.viewstateservice.endGameEnabled = true
            self.viewstateservice.questionSelectorPanelEnabled = true
            self.viewstateservice.playControlPanelEnabled = true
        }
    }
    
    func endGame() {
        //TODO: End Game Confirmation
        if (self.game.changeState(type: FFStateType.END_GAME)) {
            self.viewstateservice.playGameEnabled = false
            self.viewstateservice.endGameEnabled = false
            self.viewstateservice.newGameEnabled = true
            self.viewstateservice.fastMoneyEnabled = true
            self.viewstateservice.questionSelectorPanelEnabled = false
            self.viewstateservice.playControlPanelEnabled = false
            self.viewstateservice.questionControlPanelEnabled = false
        }
    }
    
    func startFastMoney() {
        if (self.game.changeState(type: FFStateType.FAST_MONEY)) {
            self.viewstateservice.fastMoneyEnabled = false
            self.viewstateservice.questionSelectorPanelEnabled = false
            self.viewstateservice.questionControlPanelEnabled = false
            if (!self.game.finished()) { self.viewstateservice.playGameEnabled = true }
            self.viewstateservice.endGameEnabled = true
        }
    }
}
