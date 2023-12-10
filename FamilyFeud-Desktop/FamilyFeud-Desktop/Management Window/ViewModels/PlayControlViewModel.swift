//
//  PlayControlViewModel.swift
//  FamilyFeud-Desktop
//
//  Created by Cameron Slash on 12/9/23.
//

import FeudKit
import Foundation
import Observation

@Observable
class PlayControlViewModel {
    private var windowcontroller: ManagementWindowController
    
    private var game: FamilyFeudGame
    
    private var viewstateservice: ViewStateService
    
    public private(set) var questionEnabled = false
    
    public private(set) var faceOffEnabled = false
    
    public private(set) var familyPlayEnabled = false
    
    public private(set) var familyStealEnabled = false
    
    public private(set) var allocateEnabled = false
    
    public private(set) var revealEnabled = false
    
    init(windowcontroller: ManagementWindowController, game: FamilyFeudGame, viewstateservice: ViewStateService) {
        self.windowcontroller = windowcontroller
        self.game = game
        self.viewstateservice = viewstateservice
    }
    
    public func selectQuestion() {
        if (self.game.getState().executeAction(action: StatePlay.CHANGESTATE_SELECTQUESTION, data: [])) {
            self.enableButtons()
            self.viewstateservice.questionSelectorPanelEnabled = true
            self.viewstateservice.questionControlPanelEnabled = false
        }
    }
    
    public func faceOff() {
        if (self.game.getState().executeAction(action: StatePlay.CHANGESTATE_FACEOFF, data: [])) {
            self.enableButtons()
            self.windowcontroller.setChooseFamily(command: StateFaceOff.ACTION_CHOOSEFAMILY)
            self.viewstateservice.familiesPanelEnabled = true
            self.viewstateservice.questionSelectorPanelEnabled = false
            self.viewstateservice.questionControlPanelEnabled = true
        }
    }
    
    public func familyPlay() { 
        if (self.game.getState().executeAction(action: StatePlay.CHANGESTATE_FAMILYPLAY, data: [])) {
            self.enableButtons()
            self.windowcontroller.setChooseFamily(command: StateFamilyPlay.ACTION_SELECTSTEALFAMILY)
            self.viewstateservice.familiesPanelEnabled = true
        }
    }
    
    public func familySteal() {
        if (self.game.getState().executeAction(action: StatePlay.CHANGESTATE_FAMILYSTEAL, data: [])) {
            self.enableButtons()
            self.windowcontroller.setChooseFamily(command: StateFamilySteal.ACTION_SELECTWINFAMILY)
            self.viewstateservice.familiesPanelEnabled = true
        }
    }
    
    public func allocatePoints() {
        if (self.game.getState().executeAction(action: StatePlay.CHANGESTATE_ALLOCATEPOINTS, data: [])) {
            _ = self.game.getState().executeAction(action: StatePlay.CHANGESTATE_REVEALANSWERS, data: [])
            self.viewstateservice.familiesPanelEnabled = false
            self.viewstateservice.questionControlPanelEnabled = true
            self.enableButtons()
        }
    }
    
    public func revealAnswers() { 
        if (self.game.getState().executeAction(action: StatePlay.CHANGESTATE_REVEALANSWERS, data: [])) {
            self.viewstateservice.questionControlPanelEnabled = true
            self.enableButtons()
        }
    }
    
    public func enableButtons() {
        if (self.game.getState() is StatePlay) {
            let state = (self.game.getState() as! StatePlay).getPlayState()!
            self.questionEnabled = state.getType() == FFPlayStateType.REVEAL_ANSWERS
            self.faceOffEnabled = state.getType() == FFPlayStateType.SELECT_QUESTION
            self.familyPlayEnabled = state.getType() == FFPlayStateType.FACE_OFF
            self.familyStealEnabled = state.getType() == FFPlayStateType.FAMILY_PLAY
            self.allocateEnabled = state.getType() == FFPlayStateType.FAMILY_PLAY || state.getType() == FFPlayStateType.FAMILY_STEAL
            self.revealEnabled = state.getType() == FFPlayStateType.ALLOCATE_POINTS
        } else {
            self.questionEnabled =  false
            self.faceOffEnabled = false
            self.familyPlayEnabled = false
            self.familyStealEnabled = false
            self.allocateEnabled = false
            self.revealEnabled = false
        }
    }
}
