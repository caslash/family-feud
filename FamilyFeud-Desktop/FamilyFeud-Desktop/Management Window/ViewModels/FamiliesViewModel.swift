//
//  FamiliesViewModel.swift
//  FamilyFeud-Desktop
//
//  Created by Cameron Slash on 12/8/23.
//

import FeudKit
import Foundation
import Observation

class FamiliesViewModel {
    private var windowcontroller: ManagementWindowController
    
    private var game: FamilyFeudGame
    
    public var viewstateservice: ViewStateService
    
    public var families: [Family] {
        self.game.getFamilies()
    }
    
    public var selectedFamilyId: Family.ID?
    
    init(game: FamilyFeudGame, viewstateservice: ViewStateService, windowcontroller: ManagementWindowController) {
        self.game = game
        self.viewstateservice = viewstateservice
        self.windowcontroller = windowcontroller
    }
    
    public func select() {
        if let selectedFamilyId {
            if let command = self.windowcontroller.chooseFamilyCommand {
                _ = self.game.getState().executeAction(action: StatePlay.ACTION_EXECUTEPLAYACTION, data: [
                    command,
                    families.firstIndex { $0.id == selectedFamilyId } ?? -1
                ])
            }
        }
    }
}
